import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { Edit, Ref } from './domain/fhir';
import {
  householdOf,
  versionOf,
  type Panel,
  type PanelPatient,
} from './domain/panel';
import type { Envelope, Visit } from './domain/visit';
import type { SyncResult } from './services/medplum';

export type Role = 'chw' | 'clinic';
export type Peer = { address: string; name: string };
export type Synced = 'pending' | 'added' | 'duplicate' | 'conflict';

/** A signed record, and what its bundle does. Both roles keep these until Medplum answers. */
export type Rec = {
  id: string; // the envelope id
  env: Envelope;
  visit?: Visit;
  edit?: Edit;
  synced: Synced;
  reason?: string; // Medplum's word on a conflict
};

/** Health worker side: a record this phone signed. */
export type Sent = Rec & {
  lastSentAt: number;
  delivered: boolean; // the clinic acknowledged it
};

/** Clinic side: a record that arrived over the mesh, its signature checked. */
export type Received = Rec & {
  from: string;
  hops: number;
  receivedAt: number;
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
  // Medplum: who this phone signs for, and what it knows offline
  practitioner: Ref | null;
  panel: Panel | null;
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
  'practitioner',
  'panel',
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
  practitioner: null,
  panel: null,
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

/** Clinic: accept a record only from an enrolled worker, once per record. */
export function receive(
  s: State,
  from: string,
  rec: Rec,
  hops: number,
  now: number,
): State {
  if (!s.workers.some(w => w.address === from)) return s;
  if (s.received.some(r => r.id === rec.id)) return s;
  return {
    ...s,
    received: [{ ...rec, from, hops, receivedAt: now }, ...s.received],
  };
}

/**
 * Health worker: the clinic's receipt, honoured only from the enrolled clinic.
 * A later receipt also says what Medplum made of it, for phones that never get signal.
 */
export function acknowledge(
  s: State,
  from: string,
  id: string,
  synced?: Synced | 'rejected',
  reason?: string,
): State {
  if (from !== s.clinic?.address) return s;
  if (synced === 'rejected') {
    return { ...s, sent: s.sent.filter(x => x.id !== id) };
  }
  return {
    ...s,
    sent: s.sent.map(x =>
      x.id !== id
        ? x
        : {
            ...x,
            delivered: true,
            ...(synced && x.synced === 'pending' && { synced, reason }),
          },
    ),
  };
}

/** Records still on their way to Medplum that the clinic has not acknowledged, once the wait is up. */
export const dueForResend = (s: State, now: number) =>
  s.sent.filter(
    x =>
      !x.delivered && x.synced === 'pending' && now - x.lastSentAt >= RESEND_MS,
  );

const OUTCOME = {
  applied: 'added',
  duplicate: 'duplicate',
  conflict: 'conflict',
} as const;

/** Medplum's answers. Only a rejected record is dropped; a conflict stays for a person to settle. */
export function settle(s: State, results: SyncResult[]): State {
  const byId = new Map(results.filter(r => r.id).map(r => [r.id!, r]));
  const apply = <T extends Rec>(list: T[]): T[] =>
    list
      .filter(x => byId.get(x.id)?.status !== 'rejected')
      .map(x => {
        const r = byId.get(x.id);
        return r && r.status !== 'rejected'
          ? { ...x, synced: OUTCOME[r.status], reason: r.reason }
          : x;
      });
  return { ...s, sent: apply(s.sent), received: apply(s.received) };
}

/** Keeps the newest panel, wherever it came from. */
export const takePanel = (s: State, panel: Panel): State =>
  s.panel && s.panel.at >= panel.at ? s : { ...s, panel };

export function carry(s: State, c: Carried): State {
  if (s.carried.some(x => x.id === c.id)) return s;
  return { ...s, carried: [c, ...s.carried].slice(0, CARRIED_CAP) };
}

export type ChartVisit = Visit & { pending: boolean };
export type ChartPatient = Omit<PanelPatient, 'visits'> & {
  household: string;
  visits: ChartVisit[];
  edit?: Rec; // an edit Medplum has not settled: pending, or a conflict
};

/**
 * The merged view: the last snapshot with this phone's own records laid over
 * it, so a visit or edit shows the moment it is made, signal or not.
 */
export function chart(s: State): ChartPatient[] {
  const recs: Rec[] = s.role === 'clinic' ? s.received : s.sent;
  return (s.panel?.patients ?? []).map(p => {
    const id = p.resource.id;
    const known = new Set(p.visits.map(v => v.id));
    const extra = recs
      .filter(
        r => r.visit && r.visit.patientId === id && !known.has(r.visit.id),
      )
      .map(r => ({ ...r.visit!, pending: r.synced === 'pending' }));
    // An edit made on the version the panel holds is the newest word, until the panel moves on.
    const live = recs.find(
      r =>
        !!r.edit &&
        r.edit.patientId === id &&
        r.edit.base === versionOf(p.resource) &&
        r.synced !== 'conflict',
    );
    return {
      ...p,
      household: live ? live.edit!.household : householdOf(p.resource),
      visits: [...extra, ...p.visits.map(v => ({ ...v, pending: false }))].sort(
        (a, b) => b.at - a.at,
      ),
      edit: recs.find(
        r =>
          r.edit?.patientId === id &&
          (r.synced === 'pending' || r.synced === 'conflict'),
      ),
    };
  });
}

// --- the store ---

let state = INITIAL;
const listeners = new Set<() => void>();
const KEY = 'wecare/state/v2';

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
