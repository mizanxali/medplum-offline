import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { Visit } from './domain/visit';

export type Role = 'chw' | 'clinic';
export type Peer = { address: string; name: string };
export type Synced = 'pending' | 'added' | 'duplicate';

/** Health worker side: a visit this phone recorded. */
export type Sent = {
  visit: Visit;
  lastSentAt: number;
  delivered: boolean; // the clinic acknowledged it
  synced: Synced;
};

/** Clinic side: a visit that arrived over the mesh. */
export type Received = {
  visit: Visit;
  from: string;
  hops: number;
  receivedAt: number;
  synced: Synced;
};

/** A frame this phone forwarded for two other phones. It never sees inside. */
export type Carried = {
  id: string;
  from: string;
  to: string;
  hops: number;
  at: number;
};

export type State = {
  role: Role | null;
  name: string;
  // runtime
  status: 'off' | 'starting' | 'on' | 'error';
  error: string;
  address: string;
  neighbors: string[];
  syncNote: string;
  // health worker
  clinic: Peer | null;
  enrolled: boolean;
  sent: Sent[];
  // clinic
  workers: Peer[];
  requests: Peer[];
  received: Received[];
  // both
  carried: Carried[];
};

const PERSISTED = [
  'role',
  'name',
  'clinic',
  'enrolled',
  'sent',
  'workers',
  'received',
  'carried',
] as const;

export const INITIAL: State = {
  role: null,
  name: '',
  status: 'off',
  error: '',
  address: '',
  neighbors: [],
  syncNote: '',
  clinic: null,
  enrolled: false,
  sent: [],
  workers: [],
  requests: [],
  received: [],
  carried: [],
};

// --- pure transitions (tested) ---

export const RESEND_MS = 30_000;
const CARRIED_CAP = 50;

/** Clinic: accept a visit only from an enrolled worker, once per visit id. */
export function receiveVisit(
  s: State,
  from: string,
  visit: Visit,
  hops: number,
  now: number,
): State {
  if (!s.workers.some(w => w.address === from)) return s;
  if (s.received.some(r => r.visit.id === visit.id)) return s;
  const entry: Received = {
    visit,
    from,
    hops,
    receivedAt: now,
    synced: 'pending',
  };
  return { ...s, received: [entry, ...s.received] };
}

/** Health worker: the clinic's receipt, honoured only from the enrolled clinic. */
export function acknowledge(s: State, from: string, id: string): State {
  if (from !== s.clinic?.address) return s;
  return {
    ...s,
    sent: s.sent.map(x => (x.visit.id === id ? { ...x, delivered: true } : x)),
  };
}

/** Visits the clinic has not acknowledged and that have waited long enough to resend. */
export const dueForResend = (s: State, now: number) =>
  s.sent.filter(x => !x.delivered && now - x.lastSentAt >= RESEND_MS);

export function carry(s: State, c: Carried): State {
  if (s.carried.some(x => x.id === c.id)) return s;
  return { ...s, carried: [c, ...s.carried].slice(0, CARRIED_CAP) };
}

// --- the store ---

let state = INITIAL;
const listeners = new Set<() => void>();
const KEY = 'wecare/state/v1';

export const getState = () => state;

export function setState(next: State | ((s: State) => State)) {
  state = typeof next === 'function' ? next(state) : next;
  listeners.forEach(l => l());
  const saved = Object.fromEntries(PERSISTED.map(k => [k, state[k]]));
  AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
}

export async function loadState() {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  if (raw) state = { ...INITIAL, ...JSON.parse(raw) };
  listeners.forEach(l => l());
}

export const useStore = () =>
  useSyncExternalStore(l => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getState);
