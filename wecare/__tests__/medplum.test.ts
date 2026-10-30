import { pushVisit, resetToken } from '../src/services/medplum';
import { NORMAL, ROSTER } from '../src/domain/visit';

const config = {
  baseUrl: 'https://medplum.test/',
  clientId: 'id',
  clientSecret: 's&cret',
};
const visit = {
  id: 'v-1',
  patient: ROSTER[0],
  vitals: NORMAL,
  at: 0,
  chwName: 'Ada',
};
const json = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status < 300,
    status,
    json: () => Promise.resolve(body),
  });
const transaction = (status: string) => ({
  entry: [{}, { response: { status } }],
});

describe('pushVisit', () => {
  let calls: { url: string; init: any }[];
  let answers: Array<() => Promise<unknown>>;

  beforeEach(() => {
    resetToken();
    calls = [];
    answers = [];
    (globalThis as any).fetch = (url: string, init: any) => {
      calls.push({ url, init });
      return answers.shift()!();
    };
  });

  it('signs in once, then posts a transaction bundle', async () => {
    answers.push(
      () => json(200, { access_token: 't1', expires_in: 3600 }),
      () => json(200, transaction('201 Created')),
      () => json(200, transaction('200 OK')),
    );
    expect(await pushVisit(config, visit)).toBe('added');
    expect(await pushVisit(config, visit)).toBe('duplicate');

    expect(calls.map(c => c.url)).toEqual([
      'https://medplum.test/oauth2/token',
      'https://medplum.test/fhir/R4',
      'https://medplum.test/fhir/R4',
    ]);
    expect(calls[0].init.body).toContain('client_secret=s%26cret');
    expect(calls[1].init.headers.Authorization).toBe('Bearer t1');
    expect(JSON.parse(calls[1].init.body).type).toBe('transaction');
  });

  it('surfaces the server reason when a visit is refused', async () => {
    answers.push(
      () => json(200, { access_token: 't1', expires_in: 3600 }),
      () => json(400, { issue: [{ details: { text: 'Invalid resource' } }] }),
    );
    await expect(pushVisit(config, visit)).rejects.toThrow(
      'Medplum refused the visit (400: Invalid resource)',
    );
  });
});
