// Against a real Medplum: MEDPLUM_LIVE=1 npx jest medplum.live
// Uses src/config.local.ts; skipped otherwise.
import { MEDPLUM } from '../src/config';
import { newId, NORMAL, ROSTER } from '../src/domain/visit';
import { pushVisit } from '../src/services/medplum';

const env = (globalThis as any).process?.env ?? {};
const live = env.MEDPLUM_LIVE === '1' && MEDPLUM ? it : it.skip;

live(
  'a visit is added once, then refused as a duplicate',
  async () => {
    const visit = {
      id: newId(),
      patient: ROSTER[4],
      vitals: { ...NORMAL, respRate: 27, spo2: 90, pulse: 124 },
      at: Date.now(),
      chwName: 'Live test',
    };
    expect(await pushVisit(MEDPLUM!, visit)).toBe('added');
    expect(await pushVisit(MEDPLUM!, visit)).toBe('duplicate');
  },
  30_000,
);
