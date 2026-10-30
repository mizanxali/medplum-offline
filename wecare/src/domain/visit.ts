import type { Consciousness, Vitals } from './news2';

/** One home visit, as its signed FHIR bundle records it. */
export type Visit = {
  id: string;
  patientId: string; // the Medplum Patient id
  vitals: Vitals;
  at: number; // ms since epoch, recorded by the health worker's phone
  by: string; // the health worker's name
  note: string;
};

/** A signed record: `body` is the exact signed JSON string `{ id, created, bundle }`. */
export type Envelope = { body: string; sig: string; key: string };

/**
 * Mesh messages. Health worker to clinic: a signed record. Clinic to health
 * worker: its receipt (and later what the EHR said), and the worker's panel.
 */
export type Wire =
  | { t: 'env'; env: Envelope }
  | {
      t: 'ack';
      id: string;
      synced?: 'added' | 'duplicate' | 'conflict' | 'rejected';
      reason?: string;
    }
  | { t: 'panel'; panel: unknown }; // checked by parsePanel

/** Plausible ranges, used by the form steppers and to refuse garbage from the wire. */
export const RANGES = {
  respRate: [4, 60],
  spo2: [50, 100],
  systolic: [50, 260],
  pulse: [20, 220],
  tempC: [30, 43],
} as const;

export const NOTE_MAX = 1000;

// ponytail: Math.random ids, unique enough for a demo; switch to
// crypto.getRandomValues once Hermes ships it without a polyfill.
export function newId(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${
    '89ab'[Math.floor(Math.random() * 4)]
  }${hex(3)}-${hex(12)}`;
}

export const str = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
export const num = (
  v: unknown,
  [lo, hi]: readonly [number, number],
): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const CONSCIOUSNESS: readonly Consciousness[] = ['A', 'C', 'V', 'P', 'U'];

export function isVitals(v: any): v is Vitals {
  return (
    !!v &&
    num(v.respRate, RANGES.respRate) &&
    num(v.spo2, RANGES.spo2) &&
    typeof v.onOxygen === 'boolean' &&
    num(v.systolic, RANGES.systolic) &&
    num(v.pulse, RANGES.pulse) &&
    CONSCIOUSNESS.includes(v.consciousness) &&
    num(v.tempC, RANGES.tempC)
  );
}

const SYNCED = ['added', 'duplicate', 'conflict', 'rejected'] as const;

/**
 * Parses a mesh message. The sender is an MLS-authenticated phone, but its
 * content is still input: anything malformed is dropped, never repaired.
 * A record's own signature is checked separately (envelope.ts).
 */
export function parseWire(content: string): Wire | null {
  let m: any;
  try {
    m = JSON.parse(content);
  } catch {
    return null;
  }
  if (m?.t === 'ack') {
    if (!str(m.id, 64)) return null;
    return {
      t: 'ack',
      id: m.id,
      ...(SYNCED.includes(m.synced) && { synced: m.synced }),
      ...(str(m.reason, 300) && { reason: m.reason }),
    };
  }
  if (m?.t === 'env') {
    const e = m.env;
    const ok = str(e?.body, 64 * 1024) && str(e?.sig, 200) && str(e?.key, 100);
    return ok
      ? { t: 'env', env: { body: e.body, sig: e.sig, key: e.key } }
      : null;
  }
  if (m?.t === 'panel' && m.panel) {
    return { t: 'panel', panel: m.panel };
  }
  return null;
}

/** Normal adult vitals: the form's starting point. */
export const NORMAL: Vitals = {
  respRate: 16,
  spo2: 97,
  onOxygen: false,
  systolic: 122,
  pulse: 76,
  consciousness: 'A',
  tempC: 36.8,
};
