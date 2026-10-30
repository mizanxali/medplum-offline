jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: () => Promise.resolve(),
  getItem: () => Promise.resolve(null),
}));

import type { Panel } from '../src/domain/panel';
import { NORMAL, type Visit } from '../src/domain/visit';
import {
  acknowledge,
  carry,
  chart,
  dueForResend,
  INITIAL,
  receive,
  RESEND_MS,
  settle,
  takePanel,
  type Rec,
  type Sent,
  type State,
} from '../src/state';

const env = { body: '{}', sig: 's', key: 'k' };
const visit = (id: string, at = 0): Visit => ({
  id,
  patientId: 'p-1',
  vitals: NORMAL,
  at,
  by: 'Ada',
  note: '',
});
const rec = (id: string, patch: Partial<Rec> = {}): Rec => ({
  id,
  env,
  synced: 'pending',
  ...patch,
});
const sent = (id: string, patch: Partial<Rec> = {}): Sent => ({
  ...rec(id, patch),
  lastSentAt: 0,
  delivered: false,
});

const clinic: State = {
  ...INITIAL,
  role: 'clinic',
  workers: [{ address: 'off1ada', name: 'Ada' }],
};

describe('clinic', () => {
  it('takes a record from an enrolled worker once', () => {
    const once = receive(clinic, 'off1ada', rec('e-1'), 2, 1);
    const twice = receive(once, 'off1ada', rec('e-1'), 1, 2);
    expect(twice.received).toHaveLength(1);
    expect(twice.received[0]).toMatchObject({ hops: 2, synced: 'pending' });
  });

  it('ignores a record from a phone it never enrolled', () => {
    expect(receive(clinic, 'off1eve', rec('e-1'), 1, 1)).toBe(clinic);
  });
});

describe('health worker', () => {
  const chw: State = {
    ...INITIAL,
    role: 'chw',
    clinic: { address: 'off1clinic', name: 'Riverside' },
    enrolled: true,
    sent: [sent('e-1')],
  };

  it('honours a receipt only from its clinic', () => {
    expect(acknowledge(chw, 'off1eve', 'e-1').sent[0].delivered).toBe(false);
    expect(acknowledge(chw, 'off1clinic', 'e-1').sent[0].delivered).toBe(true);
  });

  it('hears what Medplum said through the clinic', () => {
    expect(acknowledge(chw, 'off1clinic', 'e-1', 'added').sent[0].synced).toBe(
      'added',
    );
    expect(
      acknowledge(chw, 'off1clinic', 'e-1', 'conflict', 'newer').sent[0],
    ).toMatchObject({
      synced: 'conflict',
      reason: 'newer',
    });
    expect(acknowledge(chw, 'off1clinic', 'e-1', 'rejected').sent).toHaveLength(
      0,
    );
    expect(acknowledge(chw, 'off1eve', 'e-1', 'rejected').sent).toHaveLength(1);
  });

  it('resends until acknowledged, no sooner than the interval', () => {
    expect(dueForResend(chw, RESEND_MS)).toHaveLength(1);
    const later = { ...chw, sent: [{ ...chw.sent[0], lastSentAt: 10 }] };
    expect(dueForResend(later, RESEND_MS)).toHaveLength(0);
    expect(
      dueForResend(acknowledge(chw, 'off1clinic', 'e-1'), 1e12),
    ).toHaveLength(0);
  });
});

it("settles Medplum's answers: only a rejection is dropped", () => {
  const s = { ...INITIAL, sent: ['a', 'b', 'c', 'd', 'e'].map(id => sent(id)) };
  const next = settle(s, [
    { id: 'a', status: 'applied' },
    { id: 'b', status: 'duplicate' },
    { id: 'c', status: 'conflict', reason: 'newer version' },
    { id: 'd', status: 'rejected', reason: 'forbidden' },
  ]);
  expect(next.sent.map(x => [x.id, x.synced])).toEqual([
    ['a', 'added'],
    ['b', 'duplicate'],
    ['c', 'conflict'],
    ['e', 'pending'],
  ]);
  expect(next.sent[2].reason).toBe('newer version');
});

describe('chart', () => {
  const panel = (
    version: string,
    household: string,
    visits: Visit[] = [],
    at = 1,
  ): Panel => ({
    at,
    staff: [],
    patients: [
      {
        resource: {
          resourceType: 'Patient',
          id: 'p-1',
          meta: { versionId: version },
          address: [{ text: household }],
        },
        problems: [],
        allergies: [],
        meds: [],
        visits,
      },
    ],
  });
  const edit = (household: string, base: string) => ({
    patientId: 'p-1',
    household,
    base,
  });
  const chw = (p: Panel, ...list: Sent[]): State => ({
    ...INITIAL,
    role: 'chw',
    panel: p,
    sent: list,
  });

  it('keeps the newest panel', () => {
    const s = takePanel(INITIAL, panel('v1', 'A', [], 5));
    expect(takePanel(s, panel('v0', 'B', [], 4)).panel?.at).toBe(5);
    expect(takePanel(s, panel('v2', 'C', [], 6)).panel?.at).toBe(6);
  });

  it("lays this phone's visits over the snapshot, newest first, once each", () => {
    const s = chw(
      panel('v1', 'Hillside 4', [visit('old', 1)]),
      sent('e-1', { visit: visit('new', 2) }),
      sent('e-2', { visit: visit('old', 1), synced: 'added' }),
    );
    const [p] = chart(s);
    expect(p.visits.map(v => [v.id, v.pending])).toEqual([
      ['new', true],
      ['old', false],
    ]);
  });

  it('shows an unsynced household edit until the snapshot moves on', () => {
    const pending = sent('e-1', { edit: edit('River Road 12', 'v1') });
    expect(chart(chw(panel('v1', 'Hillside 4'), pending))[0]).toMatchObject({
      household: 'River Road 12',
      edit: pending,
    });
    const added = { ...pending, synced: 'added' as const };
    expect(chart(chw(panel('v1', 'Hillside 4'), added))[0].household).toBe(
      'River Road 12',
    );
    expect(chart(chw(panel('v2', 'River Road 12b'), added))[0]).toMatchObject({
      household: 'River Road 12b',
      edit: undefined,
    });
  });

  it("keeps the EHR's value on a conflict and leaves the choice to a person", () => {
    const conflict = sent('e-1', {
      edit: edit('River Road 12', 'v1'),
      synced: 'conflict',
    });
    const [p] = chart(chw(panel('v2', 'Market Lane 9'), conflict));
    expect(p.household).toBe('Market Lane 9');
    expect(p.edit).toBe(conflict);
  });
});

it('records each carried frame once', () => {
  const c = { id: 'm1', from: 'a', to: 'b', hops: 1, at: 0 };
  expect(carry(carry(INITIAL, c), c).carried).toHaveLength(1);
});
