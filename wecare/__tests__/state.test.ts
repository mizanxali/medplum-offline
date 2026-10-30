jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: () => Promise.resolve(),
  getItem: () => Promise.resolve(null),
}));

import { NORMAL, ROSTER, type Visit } from '../src/domain/visit';
import {
  acknowledge,
  carry,
  dueForResend,
  INITIAL,
  receiveVisit,
  RESEND_MS,
  type State,
} from '../src/state';

const visit: Visit = {
  id: 'v-1',
  patient: ROSTER[0],
  vitals: NORMAL,
  at: 0,
  chwName: 'Ada',
};
const clinic: State = {
  ...INITIAL,
  role: 'clinic',
  workers: [{ address: 'off1ada', name: 'Ada' }],
};

describe('clinic', () => {
  it('takes a visit from an enrolled worker once', () => {
    const once = receiveVisit(clinic, 'off1ada', visit, 2, 1);
    const twice = receiveVisit(once, 'off1ada', visit, 1, 2);
    expect(twice.received).toHaveLength(1);
    expect(twice.received[0]).toMatchObject({ hops: 2, synced: 'pending' });
  });

  it('ignores a visit from a phone it never enrolled', () => {
    expect(receiveVisit(clinic, 'off1eve', visit, 1, 1)).toBe(clinic);
  });
});

describe('health worker', () => {
  const chw: State = {
    ...INITIAL,
    role: 'chw',
    clinic: { address: 'off1clinic', name: 'Riverside' },
    enrolled: true,
    sent: [{ visit, lastSentAt: 0, delivered: false, synced: 'pending' }],
  };

  it('honours a receipt only from its clinic', () => {
    expect(acknowledge(chw, 'off1eve', 'v-1').sent[0].delivered).toBe(false);
    expect(acknowledge(chw, 'off1clinic', 'v-1').sent[0].delivered).toBe(true);
  });

  it('resends until acknowledged, no sooner than the interval', () => {
    expect(dueForResend(chw, RESEND_MS)).toHaveLength(1);
    const sent = { ...chw, sent: [{ ...chw.sent[0], lastSentAt: 10 }] };
    expect(dueForResend(sent, RESEND_MS)).toHaveLength(0);
    expect(
      dueForResend(acknowledge(chw, 'off1clinic', 'v-1'), 1e12),
    ).toHaveLength(0);
  });
});

it('records each carried frame once', () => {
  const c = { id: 'm1', from: 'a', to: 'b', hops: 1, at: 0 };
  expect(carry(carry(INITIAL, c), c).carried).toHaveLength(1);
});
