import { bytesToBase64, sign, type Signer } from '../domain/envelope';
import type { Ref } from '../domain/fhir';
import { newId, type Envelope } from '../domain/visit';

export type SyncResult = {
  id?: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  reason?: string;
};

const url = (base: string, path: string) => new URL(path, base).toString();

async function json(res: Response, what: string): Promise<any> {
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    const why =
      body?.issue?.[0]?.details?.text ??
      body?.issue?.[0]?.diagnostics ??
      body?.error_description;
    throw new Error(`${what} (${res.status}${why ? `: ${why}` : ''})`);
  }
  return body;
}

const post = (base: string, path: string, body: unknown, headers = {}) =>
  fetch(url(base, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/**
 * One-time sign-in that binds this phone's key to the user's Practitioner.
 * The password and the token are used here and dropped; the phone keeps only
 * the Practitioner reference.
 */
export async function register(
  base: string,
  signer: Signer,
  email: string,
  password: string,
): Promise<Ref> {
  // Medplum wants PKCE; plain is enough when the verifier never leaves this call.
  const verifier = newId() + newId();
  const { code } = await json(
    await post(base, 'auth/login', {
      email,
      password,
      scope: 'openid',
      codeChallenge: verifier,
      codeChallengeMethod: 'plain',
    }),
    'Sign-in refused',
  );
  if (!code)
    throw new Error(
      'This account needs to choose a project. Use a WeCare account.',
    );
  const token = await json(
    await fetch(url(base, 'oauth2/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=authorization_code&code=${encodeURIComponent(
        code,
      )}&code_verifier=${verifier}`,
    }),
    'Sign-in refused',
  );
  const profile: string = token.profile?.reference ?? '';
  if (!profile.startsWith('Practitioner/'))
    throw new Error('Only practitioners can register a phone.');
  const res = await json(
    await post(
      base,
      'offline/devices',
      {
        publicKey: bytesToBase64(await signer.getIdentityPublicKey()),
        signature: await sign(signer, `offline-device-registration|${profile}`),
      },
      { Authorization: `Bearer ${token.access_token}` },
    ),
    'Medplum refused this phone',
  );
  return res.practitioner;
}

/** Hands signed records to Medplum. No credentials: each one's signature is its authority. */
export async function syncEnvelopes(
  base: string,
  envelopes: Envelope[],
): Promise<SyncResult[]> {
  const body = await json(
    await post(base, 'offline/sync', { envelopes }),
    'Medplum refused the upload',
  );
  return body.results;
}

/** This phone's panel as Medplum's access policy lets its practitioner see it. */
export async function fetchSnapshot(base: string, signer: Signer) {
  const time = new Date().toISOString();
  return json(
    await fetch(url(base, 'offline/snapshot'), {
      headers: {
        'X-Offline-Key': bytesToBase64(await signer.getIdentityPublicKey()),
        'X-Offline-Time': time,
        'X-Offline-Signature': await sign(signer, `offline-snapshot|${time}`),
      },
    }),
    'Medplum refused the snapshot',
  );
}
