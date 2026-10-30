// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { WithId } from '@medplum/core';
import { createReference } from '@medplum/core';
import type { AccessPolicy, Bundle, Patient, Practitioner, Provenance } from '@medplum/fhirtypes';
import express from 'express';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import request from 'supertest';
import { initApp, shutdownApp } from '../app';
import { loadTestConfig } from '../config/loader';
import { getProjectSystemRepo } from '../fhir/repo';
import { addTestUser, createTestProject, withTestContext } from '../test.setup';
import { addressFromKey, signedBy } from './routes';

const app = express();

type Device = { key: string; address: string; sign: (data: string) => string };

function newDevice(): Device {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return {
    key: raw.toString('base64'),
    address: addressFromKey(raw),
    sign: (data) => sign(null, Buffer.from(data), privateKey).toString('base64'),
  };
}

type Envelope = { body: string; sig: string; key: string };
type Result = { id?: string; status: string; reason?: string };

const envelope = (device: Device, bundle: Bundle, id = randomUUID()): Envelope => {
  const body = JSON.stringify({ id, created: new Date().toISOString(), bundle });
  return { body, sig: device.sign(body), key: device.key };
};

function visit(patientId: string, visitId = randomUUID()): Bundle {
  const encounter = `urn:uuid:${randomUUID()}`;
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        fullUrl: encounter,
        resource: {
          resourceType: 'Encounter',
          identifier: [{ system: 'urn:wecare:visit', value: visitId }],
          status: 'finished',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'HH' },
          subject: { reference: `Patient/${patientId}` },
          period: { start: new Date().toISOString() },
        },
        request: { method: 'POST', url: 'Encounter', ifNoneExist: `identifier=urn:wecare:visit|${visitId}` },
      },
      {
        fullUrl: `urn:uuid:${randomUUID()}`,
        resource: {
          resourceType: 'Observation',
          identifier: [{ system: 'urn:wecare:observation', value: `${visitId}/hr` }],
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '8867-4' }] },
          subject: { reference: `Patient/${patientId}` },
          encounter: { reference: encounter },
          valueQuantity: { value: 76, unit: '/min' },
        },
        request: { method: 'POST', url: 'Observation', ifNoneExist: `identifier=urn:wecare:observation|${visitId}/hr` },
      },
      {
        fullUrl: `urn:uuid:${randomUUID()}`,
        resource: {
          resourceType: 'DocumentReference',
          identifier: [{ system: 'urn:wecare:note', value: visitId }],
          status: 'current',
          subject: { reference: `Patient/${patientId}` },
          context: { encounter: [{ reference: encounter }] },
          content: [
            { attachment: { contentType: 'text/plain', data: Buffer.from('Eating well.').toString('base64') } },
          ],
        },
        request: { method: 'POST', url: 'DocumentReference', ifNoneExist: `identifier=urn:wecare:note|${visitId}` },
      },
    ],
  };
}

const household = (patient: Patient, text: string): Bundle => ({
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      resource: { ...patient, address: [{ text }] },
      request: { method: 'PUT', url: `Patient/${patient.id}`, ifMatch: `W/"${patient.meta?.versionId}"` },
    },
  ],
});

const POLICY: AccessPolicy = {
  resourceType: 'AccessPolicy',
  resource: [
    { resourceType: 'Patient', criteria: 'Patient?general-practitioner=%profile' },
    { resourceType: 'Practitioner', readonly: true },
    { resourceType: 'Encounter' },
    { resourceType: 'Observation' },
    { resourceType: 'DocumentReference' },
    { resourceType: 'Condition', readonly: true },
    { resourceType: 'AllergyIntolerance', readonly: true },
    { resourceType: 'MedicationStatement', readonly: true },
    { resourceType: 'Provenance', interaction: ['create', 'read', 'search'] },
  ],
};

describe('Offline', () => {
  let ada: Awaited<ReturnType<typeof addTestUser>>;
  let bob: Awaited<ReturnType<typeof addTestUser>>;
  let mine: WithId<Patient>;
  let other: WithId<Patient>;
  const phone = newDevice();

  const sync = async (...envelopes: unknown[]): Promise<Result[]> =>
    (await request(app).post('/offline/sync').send({ envelopes }).expect(200)).body.results;

  beforeAll(async () => {
    const config = await loadTestConfig();
    await withTestContext(async () => {
      await initApp(app, config);
      const { project } = await createTestProject({ project: { checkReferencesOnWrite: true } });
      ada = await addTestUser(project, { accessPolicy: POLICY });
      bob = await addTestUser(project, { accessPolicy: POLICY });
      const repo = await getProjectSystemRepo(project);
      const patient = (gp?: Practitioner): Patient => ({
        resourceType: 'Patient',
        meta: { project: project.id },
        name: [{ text: 'Synthetic Patient' }],
        generalPractitioner: gp && [createReference(gp)],
      });
      mine = await repo.createResource(patient(ada.profile as Practitioner));
      other = await repo.createResource(patient());
      await repo.createResource({
        resourceType: 'Condition',
        meta: { project: project.id },
        subject: createReference(mine),
        code: { text: 'Hypertension' },
      });
    });
  });

  afterAll(async () => {
    await shutdownApp();
  });

  test('address derives from the key as the SDK does', () => {
    const key = Buffer.from('xRyOd2sn17UCuMhlToCnL0E4bolGlc5hKxVOxt+XjZY=', 'base64');
    expect(addressFromKey(key)).toBe('off1q9vt9yk48hn9npcfsm2hyv4tqv6a4h9vsqss2z5f');
  });

  test('signatures', () => {
    expect(signedBy(phone.key, 'hello', phone.sign('hello'))).toBe(phone.address);
    expect(signedBy(phone.key, 'hellO', phone.sign('hello'))).toBeUndefined();
    expect(signedBy('AAAA', 'hello', phone.sign('hello'))).toBeUndefined();
  });

  test('registration', async () => {
    const proof = (who: { profile: { id?: string } }, device = phone): object => ({
      publicKey: device.key,
      signature: device.sign(`offline-device-registration|Practitioner/${who.profile.id}`),
    });
    const register = (token: string, body: object): request.Test =>
      request(app).post('/offline/devices').set('Authorization', `Bearer ${token}`).send(body);

    await register(ada.accessToken, { ...proof(ada), signature: phone.sign('something else') }).expect(400);
    const res = await register(ada.accessToken, proof(ada)).expect(201);
    expect(res.body).toMatchObject({
      address: phone.address,
      practitioner: { reference: `Practitioner/${ada.profile.id}` },
    });
    await register(ada.accessToken, proof(ada)).expect(200);
    await register(bob.accessToken, proof(bob)).expect(409);
    await request(app).post('/offline/devices').send(proof(ada)).expect(401);

    const patientUser = await withTestContext(async () =>
      addTestUser((await createTestProject()).project, { resourceType: 'Patient' })
    );
    await register(patientUser.accessToken, proof(patientUser, newDevice())).expect(403);
  });

  test('applied once, as the author, with a signed Provenance', async () => {
    const env = envelope(phone, visit(mine.id));
    expect(await sync(env)).toMatchObject([{ status: 'applied' }]);
    expect(await sync(env)).toMatchObject([{ status: 'duplicate' }]);

    const id = JSON.parse(env.body).id;
    const res = await request(app)
      .get(`/fhir/R4/Provenance?_tag=urn:offline-protocol:envelope|${phone.address}/${id}`)
      .set('Authorization', `Bearer ${ada.accessToken}`)
      .expect(200);
    const provenance = res.body.entry[0].resource as Provenance;
    expect(provenance.target).toHaveLength(3);
    expect(provenance.agent[0].who.reference).toBe(`Practitioner/${ada.profile.id}`);
    expect(provenance.signature?.[0].data).toBe(env.sig);
    const signedBody = provenance.signature?.[0].extension?.[0].valueBase64Binary as string;
    expect(Buffer.from(signedBody, 'base64').toString()).toBe(env.body);

    const encounter = await request(app)
      .get(`/fhir/R4/${provenance.target[0].reference}`)
      .set('Authorization', `Bearer ${ada.accessToken}`)
      .set('X-Medplum', 'extended')
      .expect(200);
    expect(encounter.body.meta.author.reference).toBe(`Practitioner/${ada.profile.id}`);
  });

  test('the same envelope twice at once is applied once', async () => {
    const env = envelope(phone, visit(mine.id));
    const results = (await Promise.all([sync(env), sync(env)])).flat();
    expect(results.map((r) => r.status).sort()).toEqual(['applied', 'duplicate']);
  });

  test('a stale edit is a conflict, never an overwrite', async () => {
    const res = await request(app)
      .get(`/fhir/R4/Patient/${mine.id}`)
      .set('Authorization', `Bearer ${ada.accessToken}`)
      .expect(200);
    const seen = res.body as Patient;
    expect(await sync(envelope(phone, household(seen, 'Hillside 5')))).toMatchObject([{ status: 'applied' }]);
    expect(await sync(envelope(phone, household(seen, 'Hillside 6')))).toMatchObject([{ status: 'conflict' }]);
  });

  test('rejected envelopes', async () => {
    const env = envelope(phone, visit(mine.id));
    const tampered = { ...env, body: env.body.replace('"finished"', '"cancelled"') };
    expect(tampered.body).not.toBe(env.body);
    const stranger = newDevice();
    const del: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [{ request: { method: 'DELETE', url: `Patient/${mine.id}` } }],
    };
    const condition: Bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          fullUrl: `urn:uuid:${randomUUID()}`,
          resource: {
            resourceType: 'Condition',
            subject: { reference: `Patient/${mine.id}` },
            code: { text: 'Asthma' },
          },
          request: { method: 'POST', url: 'Condition', ifNoneExist: `code:text=Asthma&subject=Patient/${mine.id}` },
        },
      ],
    };
    const results = await sync(
      tampered,
      envelope(stranger, visit(mine.id)),
      envelope(phone, del),
      { body: 'not json', sig: '', key: '' },
      envelope(phone, visit(other.id)),
      envelope(phone, condition)
    );
    expect(results.map((r) => [r.status, r.reason?.split(':')[0]])).toEqual([
      ['rejected', 'bad_signature'],
      ['rejected', 'unknown_device'],
      ['rejected', 'bad_bundle'],
      ['rejected', 'bad_envelope'],
      ['rejected', 'invalid'], // the access policy hides that patient, so the reference does not resolve
      ['rejected', 'forbidden'], // Conditions are read-only for her
    ]);
    await request(app)
      .post('/offline/sync')
      .send({ envelopes: Array(51).fill(env) })
      .expect(400);
  });

  test('snapshot', async () => {
    const time = new Date().toISOString();
    const get = (at: string, device = phone): request.Test =>
      request(app)
        .get('/offline/snapshot')
        .set('X-Offline-Key', device.key)
        .set('X-Offline-Time', at)
        .set('X-Offline-Signature', device.sign(`offline-snapshot|${at}`));

    const res = await get(time).expect(200);
    const types = res.body.entry.map((e: { resource: { resourceType: string; id: string } }) => e.resource);
    const of = (t: string): any[] => types.filter((r: { resourceType: string }) => r.resourceType === t);
    expect(of('Patient').map((p: Patient) => p.id)).toEqual([mine.id]);
    expect(of('Patient')[0].meta.versionId).toBeDefined();
    expect(of('Practitioner')).toHaveLength(1);
    expect(of('Condition')).toHaveLength(1);
    expect(of('Encounter')).toHaveLength(2);
    expect(of('Observation')).toHaveLength(2);
    expect(of('DocumentReference')).toHaveLength(2);

    await get(new Date(Date.now() - 10 * 60_000).toISOString()).expect(401);
    await get(time, newDevice()).expect(401);
    await request(app)
      .get('/offline/snapshot')
      .set('X-Offline-Key', phone.key)
      .set('X-Offline-Time', time)
      .set('X-Offline-Signature', phone.sign('offline-snapshot|2020-01-01T00:00:00.000Z'))
      .expect(401);
  });
});
