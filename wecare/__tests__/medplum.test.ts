import type { Signer } from '../src/domain/envelope';
import {
  fetchSnapshot,
  register,
  syncEnvelopes,
} from '../src/services/medplum';

const base = 'https://medplum.test/';
const signer: Signer = {
  signData: async d => d.slice(0, 4), // stands in for an Ed25519 signature
  verifySignature: async () => true,
  getIdentityPublicKey: async () => [1, 2, 3],
  deriveAddress: async () => 'off1phone',
};
const json = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status < 300,
    status,
    json: () => Promise.resolve(body),
  });

let calls: { url: string; init: any }[];
let answers: Array<() => Promise<unknown>>;

beforeEach(() => {
  calls = [];
  answers = [];
  (globalThis as any).fetch = (url: string, init: any) => {
    calls.push({ url, init });
    return answers.shift()!();
  };
});

describe('register', () => {
  it('signs in once with PKCE, then binds the phone key to the practitioner', async () => {
    const practitioner = {
      reference: 'Practitioner/ada',
      display: 'Ada Wanjiru',
    };
    answers.push(
      () => json(200, { code: 'c1' }),
      () =>
        json(200, {
          access_token: 't1',
          profile: { reference: 'Practitioner/ada' },
        }),
      () => json(201, { address: 'off1phone', practitioner }),
    );
    expect(await register(base, signer, 'ada@wecare.local', 'pw')).toEqual(
      practitioner,
    );

    expect(calls.map(c => c.url)).toEqual([
      'https://medplum.test/auth/login',
      'https://medplum.test/oauth2/token',
      'https://medplum.test/offline/devices',
    ]);
    const login = JSON.parse(calls[0].init.body);
    expect(login).toMatchObject({
      email: 'ada@wecare.local',
      codeChallengeMethod: 'plain',
    });
    expect(calls[1].init.body).toContain(
      `code_verifier=${login.codeChallenge}`,
    );
    expect(calls[2].init.headers.Authorization).toBe('Bearer t1');
    // The message signed is the registration statement for this practitioner.
    const statement = 'offline-device-registration|Practitioner/ada';
    expect(JSON.parse(calls[2].init.body)).toEqual({
      publicKey: btoa('\x01\x02\x03'),
      signature: btoa(statement.slice(0, 4)),
    });
  });

  it('refuses an account that is not a practitioner', async () => {
    answers.push(
      () => json(200, { code: 'c1' }),
      () =>
        json(200, { access_token: 't1', profile: { reference: 'Patient/p' } }),
    );
    await expect(register(base, signer, 'p@x', 'pw')).rejects.toThrow(
      'Only practitioners can register a phone.',
    );
  });

  it("surfaces Medplum's reason for a refused sign-in", async () => {
    answers.push(() =>
      json(400, {
        issue: [{ details: { text: 'Email or password is invalid' } }],
      }),
    );
    await expect(register(base, signer, 'a@x', 'bad')).rejects.toThrow(
      'Sign-in refused (400: Email or password is invalid)',
    );
  });
});

it('posts signed records without credentials and returns one answer each', async () => {
  const envelopes = [{ body: '{}', sig: 's', key: 'k' }];
  answers.push(() =>
    json(200, { results: [{ id: 'e-1', status: 'applied' }] }),
  );
  expect(await syncEnvelopes(base, envelopes)).toEqual([
    { id: 'e-1', status: 'applied' },
  ]);
  expect(calls[0].url).toBe('https://medplum.test/offline/sync');
  expect(calls[0].init.headers.Authorization).toBeUndefined();
  expect(JSON.parse(calls[0].init.body)).toEqual({ envelopes });
});

it('asks for the snapshot with a fresh signed timestamp', async () => {
  answers.push(() => json(200, { resourceType: 'Bundle', entry: [] }));
  await fetchSnapshot(base, signer);
  const h = calls[0].init.headers;
  expect(Math.abs(Date.parse(h['X-Offline-Time']) - Date.now())).toBeLessThan(
    5000,
  );
  expect(h['X-Offline-Signature']).toBe(btoa('offl'));
  expect(h['X-Offline-Key']).toBe(btoa('\x01\x02\x03'));
});
