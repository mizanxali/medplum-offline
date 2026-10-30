// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import {
  badRequest,
  conflict,
  forbidden,
  formatHumanName,
  getReferenceString,
  getStatus,
  normalizeErrorString,
  OperationOutcomeError,
  Operator,
  parseSearchRequest,
  unauthorized,
} from '@medplum/core';
import { processBatch } from '@medplum/fhir-router';
import type {
  Bundle,
  BundleEntry,
  Login,
  Practitioner,
  Project,
  ProjectMembership,
  Provenance,
  Reference,
  Resource,
} from '@medplum/fhirtypes';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { createHash, randomUUID, verify } from 'node:crypto';
import { AuthenticatedRequestContext, getAuthenticatedContext, getRequestContext } from '../context';
import { getRepoForLogin } from '../fhir/accesspolicy';
import { getInactiveReason } from '../fhir/projectmembership';
import type { Repository } from '../fhir/repo';
import { getProjectSystemRepo, getShardSystemRepo } from '../fhir/repo';
import { getInternalFhirRouter } from '../fhir/routes';
import { PLACEHOLDER_SHARD_ID } from '../fhir/sharding';
import type { AuthState } from '../oauth/middleware';
import { authenticateRequest } from '../oauth/middleware';
import { requestContextStore } from '../request-context-store';

// Offline Protocol devices: a phone signs FHIR transactions with its Ed25519 identity key, any phone
// may carry them here, and each one is applied exactly once as the Practitioner who owns the key.

export const ADDRESS_SYSTEM = 'urn:offline-protocol:address';
export const ENVELOPE_SYSTEM = 'urn:offline-protocol:envelope';
export const SIGNED_BODY_URL = 'urn:offline-protocol:signed-body';
export const SIGNING_KEY_URL = 'urn:offline-protocol:signing-key';

const MAX_ENVELOPES = 50;
const MAX_BODY = 64 * 1024;
const MAX_ENTRIES = 100;
const SNAPSHOT_SKEW_MS = 5 * 60_000;
const VISITS_PER_PATIENT = 3;

// --- identity ---

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values: number[]): number {
  const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) {
        chk ^= gen[i];
      }
    }
  }
  return chk;
}

/**
 * The SDK address of an Ed25519 public key: bech32m, HRP `off`, over `0x01 || SHA-256(key)[0:20]`.
 * @param publicKey - The raw 32-byte public key.
 * @returns The `off1...` address.
 */
export function addressFromKey(publicKey: Buffer): string {
  const payload = Buffer.concat([Buffer.from([1]), createHash('sha256').update(publicKey).digest().subarray(0, 20)]);
  const data: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const byte of payload) {
    acc = ((acc << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      data.push((acc >>> bits) & 31);
    }
  }
  if (bits) {
    data.push((acc << (5 - bits)) & 31);
  }
  const hrp = [...'off'].map((c) => c.charCodeAt(0));
  const mod =
    polymod([...hrp.map((c) => c >> 5), 0, ...hrp.map((c) => c & 31), ...data, 0, 0, 0, 0, 0, 0]) ^ 0x2bc830a3;
  const checksum = [0, 1, 2, 3, 4, 5].map((i) => (mod >>> (5 * (5 - i))) & 31);
  return 'off1' + [...data, ...checksum].map((d) => BECH32[d]).join('');
}

const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Checks an Ed25519 signature over a UTF-8 string.
 * @param key - The base64 public key.
 * @param data - The exact string that was signed.
 * @param sig - The base64 signature.
 * @returns The signer's address, or undefined if anything is off.
 */
export function signedBy(key: unknown, data: string, sig: unknown): string | undefined {
  if (typeof key !== 'string' || typeof sig !== 'string') {
    return undefined;
  }
  const publicKey = Buffer.from(key, 'base64');
  if (publicKey.length !== 32) {
    return undefined;
  }
  try {
    const spki = { key: Buffer.concat([SPKI_ED25519, publicKey]), format: 'der', type: 'spki' } as const;
    return verify(null, Buffer.from(data, 'utf8'), spki, Buffer.from(sig, 'base64'))
      ? addressFromKey(publicKey)
      : undefined;
  } catch {
    return undefined;
  }
}

type Member = {
  practitioner: WithId<Practitioner>;
  membership: WithId<ProjectMembership>;
  project: WithId<Project>;
};

async function findPractitioner(address: string): Promise<WithId<Practitioner> | undefined> {
  const systemRepo = getShardSystemRepo(PLACEHOLDER_SHARD_ID);
  const found = await systemRepo.searchResources<Practitioner>({
    resourceType: 'Practitioner',
    filters: [{ code: 'identifier', operator: Operator.EQUALS, value: `${ADDRESS_SYSTEM}|${address}` }],
    count: 2,
  });
  return found.length === 1 ? found[0] : undefined;
}

async function findMember(address: string): Promise<Member | undefined> {
  const practitioner = await findPractitioner(address);
  if (!practitioner) {
    return undefined;
  }
  const systemRepo = getShardSystemRepo(PLACEHOLDER_SHARD_ID);
  const memberships = await systemRepo.searchResources<ProjectMembership>({
    resourceType: 'ProjectMembership',
    filters: [{ code: 'profile', operator: Operator.EQUALS, value: getReferenceString(practitioner) }],
  });
  for (const membership of memberships) {
    const project = await systemRepo.readReference<Project>(membership.project);
    if (!getInactiveReason(project, membership)) {
      return { practitioner, membership, project };
    }
  }
  return undefined;
}

/**
 * Runs `fn` as the member, under their access policy, as if they had signed in.
 * `getRepoForLogin` reads only `remoteAddress`, `client` and `scope` from the Login, so it stays in memory.
 * @param member - The member to act as.
 * @param remoteAddress - The caller's IP, for IP access rules.
 * @param fn - The work to do with the member's repository.
 * @returns The result of `fn`.
 */
async function asMember<T>(
  member: Member,
  remoteAddress: string | undefined,
  fn: (repo: Repository) => Promise<T>
): Promise<T> {
  const login: Login = {
    resourceType: 'Login',
    authMethod: 'execute',
    user: member.membership.user,
    membership: { reference: getReferenceString(member.membership) },
    authTime: new Date().toISOString(),
    remoteAddress,
  };
  const authState: AuthState = {
    login,
    project: member.project,
    membership: member.membership,
    profile: member.practitioner,
    userConfig: { resourceType: 'UserConfiguration' },
  };
  const repo = await getRepoForLogin(authState);
  const { requestId, traceId } = getRequestContext();
  const ctx = new AuthenticatedRequestContext(requestId, traceId, authState, repo);
  return requestContextStore.run(ctx, () => fn(repo));
}

const practitionerRef = (p: WithId<Practitioner>): Reference<Practitioner> => ({
  reference: getReferenceString(p),
  display: formatHumanName(p.name?.[0] ?? {}) || undefined,
});

export const offlineRouter = Router();

// --- registration: bind a device key to the signed-in Practitioner ---

offlineRouter.post('/devices', authenticateRequest, async (req: Request, res: Response) => {
  const ctx = getAuthenticatedContext();
  const profile = ctx.profile.reference ?? '';
  if (!profile.startsWith('Practitioner/')) {
    throw new OperationOutcomeError(forbidden);
  }
  const address = signedBy(req.body?.publicKey, `offline-device-registration|${profile}`, req.body?.signature);
  if (!address) {
    throw new OperationOutcomeError(badRequest('Invalid device signature'));
  }
  const owner = await findPractitioner(address);
  if (owner && getReferenceString(owner) !== profile) {
    throw new OperationOutcomeError(conflict('This device is registered to another practitioner'));
  }
  let practitioner = owner ?? (await ctx.systemRepo.readReference<Practitioner>({ reference: profile }));
  if (!owner) {
    practitioner = await ctx.systemRepo.updateResource<Practitioner>({
      ...practitioner,
      identifier: [...(practitioner.identifier ?? []), { system: ADDRESS_SYSTEM, value: address }],
    });
  }
  res.status(owner ? 200 : 201).json({ address, practitioner: practitionerRef(practitioner) });
});

// --- write side: signed transactions, applied exactly once ---

type Envelope = { body: string; sig: string; key: string };
type SyncStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected';
type SyncResult = { id?: string; status: SyncStatus; reason?: string };

function parseBody(env: unknown): { id: string; created: string; bundle: Bundle } | undefined {
  const e = env as Envelope | undefined;
  if (typeof e?.body !== 'string' || e.body.length > MAX_BODY) {
    return undefined;
  }
  try {
    const body = JSON.parse(e.body);
    const ok =
      typeof body?.id === 'string' &&
      /^[\w-]{1,64}$/.test(body.id) &&
      typeof body.created === 'string' &&
      !Number.isNaN(Date.parse(body.created));
    return ok ? body : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Only what a phone needs, and only what merges safely: conditional creates and versioned updates.
 * @param bundle - The signed bundle.
 * @returns Why the bundle is refused, or undefined when it is acceptable.
 */
function bundleProblem(bundle: Bundle | undefined): string | undefined {
  if (bundle?.resourceType !== 'Bundle' || bundle.type !== 'transaction') {
    return 'not a transaction bundle';
  }
  const entries = bundle.entry ?? [];
  if (!entries.length || entries.length > MAX_ENTRIES) {
    return 'too many or too few entries';
  }
  for (const entry of entries) {
    const { method, url = '', ifNoneExist, ifMatch } = entry.request ?? {};
    const type = entry.resource?.resourceType;
    if (type === 'Provenance') {
      return 'Provenance is written by the server';
    }
    const create = method === 'POST' && ifNoneExist && url === type && entry.fullUrl?.startsWith('urn:uuid:');
    const update =
      method === 'PUT' && ifMatch && /^[A-Z][A-Za-z]+\/[A-Za-z0-9.-]{1,64}$/.test(url) && url.startsWith(`${type}/`);
    if (!create && !update) {
      return `${method ?? 'no method'} ${url} is not allowed: only conditional creates and versioned updates`;
    }
  }
  return undefined;
}

function provenanceFor(
  env: Envelope,
  created: string,
  bundle: Bundle,
  member: Member,
  address: string,
  id: string
): BundleEntry {
  const author = practitionerRef(member.practitioner);
  const now = new Date().toISOString();
  const provenance: Provenance = {
    resourceType: 'Provenance',
    // R4 Provenance has no identifier; the envelope id is a tag, which `_tag` searches and ifNoneExist can match.
    meta: { tag: [{ system: ENVELOPE_SYSTEM, code: id }] },
    target: (bundle.entry ?? []).map((e) => ({
      reference: e.request?.method === 'PUT' ? e.request.url : e.fullUrl,
    })),
    occurredDateTime: created,
    recorded: now,
    agent: [
      {
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author' }],
        },
        who: author,
      },
      {
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'device' }],
        },
        who: { identifier: { system: ADDRESS_SYSTEM, value: address }, display: address },
        onBehalfOf: author,
      },
    ],
    signature: [
      {
        type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1', display: "Author's Signature" }],
        when: now,
        who: author,
        targetFormat: 'application/json',
        data: env.sig,
        extension: [
          { url: SIGNED_BODY_URL, valueBase64Binary: Buffer.from(env.body, 'utf8').toString('base64') },
          { url: SIGNING_KEY_URL, valueBase64Binary: env.key },
        ],
      },
    ],
  };
  return {
    fullUrl: `urn:uuid:${randomUUID()}`,
    resource: provenance,
    request: { method: 'POST', url: 'Provenance', ifNoneExist: `_tag=${ENVELOPE_SYSTEM}|${id}` },
  };
}

async function applyEnvelope(env: Envelope, remoteAddress: string | undefined): Promise<SyncResult> {
  const body = parseBody(env);
  if (!body) {
    return { status: 'rejected', reason: 'bad_envelope' };
  }
  const reject = (reason: string): SyncResult => ({ id: body.id, status: 'rejected', reason });
  const address = signedBy(env.key, env.body, env.sig);
  if (!address) {
    return reject('bad_signature');
  }
  const member = await findMember(address);
  if (!member) {
    return reject('unknown_device');
  }
  const problem = bundleProblem(body.bundle);
  if (problem) {
    return reject(`bad_bundle: ${problem}`);
  }

  // Namespaced by the signer, so no device can claim another device's envelope id.
  const provenanceId = `${address}/${body.id}`;
  const systemRepo = await getProjectSystemRepo(member.project);
  const seen = async (): Promise<boolean> =>
    (
      await systemRepo.searchResources<Provenance>({
        resourceType: 'Provenance',
        filters: [{ code: '_tag', operator: Operator.EQUALS, value: `${ENVELOPE_SYSTEM}|${provenanceId}` }],
        count: 1,
      })
    ).length > 0;
  if (await seen()) {
    return { id: body.id, status: 'duplicate' };
  }

  // The Provenance rides in the same transaction, so the writes and their record commit together.
  const bundle: Bundle = {
    ...body.bundle,
    entry: [...(body.bundle.entry ?? []), provenanceFor(env, body.created, body.bundle, member, address, provenanceId)],
  };
  try {
    const result = await asMember(member, remoteAddress, (repo) =>
      processBatch(
        {
          method: 'POST',
          url: '/',
          pathname: '/',
          params: {},
          query: {},
          body: bundle,
          config: { transactions: true },
        },
        repo,
        getInternalFhirRouter(),
        bundle
      )
    );
    const provenanceStatus = result.entry?.at(-1)?.response?.status ?? '';
    return { id: body.id, status: provenanceStatus.startsWith('201') ? 'applied' : 'duplicate' };
  } catch (err) {
    if (await seen()) {
      return { id: body.id, status: 'duplicate' }; // a concurrent upload of the same envelope won
    }
    if (!(err instanceof OperationOutcomeError)) {
      throw err;
    }
    const status = getStatus(err.outcome);
    if (status === 412 || status === 409) {
      return { id: body.id, status: 'conflict', reason: normalizeErrorString(err) };
    }
    if (status === 429 || status >= 500) {
      throw err;
    }
    return reject(status === 403 ? 'forbidden' : `invalid: ${normalizeErrorString(err)}`);
  }
}

offlineRouter.post('/sync', async (req: Request, res: Response) => {
  const envelopes: unknown = req.body?.envelopes;
  if (!Array.isArray(envelopes) || envelopes.length > MAX_ENVELOPES) {
    throw new OperationOutcomeError(badRequest(`Expected up to ${MAX_ENVELOPES} envelopes`));
  }
  const results: SyncResult[] = [];
  for (const env of envelopes) {
    results.push(await applyEnvelope(env as Envelope, req.ip));
  }
  res.json({ results });
});

// --- read side: the practitioner's panel, as their access policy allows ---

async function snapshot(repo: Repository, practitioner: WithId<Practitioner>): Promise<Resource[]> {
  const ref = getReferenceString(practitioner);
  const panel = await repo.search(
    parseSearchRequest(
      `Patient?general-practitioner=${ref}&_count=1000&_include=Patient:general-practitioner` +
        '&_revinclude=Condition:patient&_revinclude=AllergyIntolerance:patient&_revinclude=MedicationStatement:patient'
    )
  );
  const resources = (panel.entry ?? []).map((e) => e.resource as WithId<Resource>);
  // ponytail: one query per patient for "last N visits each"; fine for a health worker's panel
  const visits = await Promise.all(
    resources
      .filter((r) => r.resourceType === 'Patient')
      .map((p) =>
        repo.search(
          parseSearchRequest(
            `Encounter?subject=Patient/${p.id}&_sort=-date&_count=${VISITS_PER_PATIENT}` +
              '&_revinclude=Observation:encounter&_revinclude=DocumentReference:encounter'
          )
        )
      )
  );
  const seen = new Set<string>();
  return [...resources, ...visits.flatMap((b) => (b.entry ?? []).map((e) => e.resource as WithId<Resource>))].filter(
    (r) => {
      const key = getReferenceString(r);
      return !seen.has(key) && seen.add(key);
    }
  );
}

offlineRouter.get('/snapshot', async (req: Request, res: Response) => {
  const time = req.header('x-offline-time') ?? '';
  if (!(Math.abs(Date.now() - Date.parse(time)) <= SNAPSHOT_SKEW_MS)) {
    throw new OperationOutcomeError(unauthorized);
  }
  const address = signedBy(req.header('x-offline-key'), `offline-snapshot|${time}`, req.header('x-offline-signature'));
  const member = address && (await findMember(address));
  if (!member) {
    throw new OperationOutcomeError(unauthorized);
  }
  const resources = await asMember(member, req.ip, (repo) => snapshot(repo, member.practitioner));
  res.json({
    resourceType: 'Bundle',
    type: 'searchset',
    timestamp: new Date().toISOString(),
    entry: resources.map((resource) => ({ resource })),
  });
});
