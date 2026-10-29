import type { Consciousness, Vitals } from './news2';

export type Patient = {
  id: string;
  name: string;
  sex: 'female' | 'male';
  birthYear: number;
  household: string;
};

export type Visit = {
  id: string;
  patient: Patient;
  vitals: Vitals;
  at: number; // ms since epoch, recorded by the health worker's phone
  chwName: string;
};

/** Mesh messages. Health worker to clinic: a visit. Clinic to health worker: its receipt. */
export type Wire = { t: 'visit'; visit: Visit } | { t: 'ack'; id: string };

/** Plausible ranges, used by the form steppers and to refuse garbage from the wire. */
export const RANGES = {
  respRate: [4, 60],
  spo2: [50, 100],
  systolic: [50, 260],
  pulse: [20, 220],
  tempC: [30, 43],
} as const;

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

const str = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const num = (v: unknown, [lo, hi]: readonly [number, number]): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const CONSCIOUSNESS: readonly Consciousness[] = ['A', 'C', 'V', 'P', 'U'];

function isPatient(p: any): p is Patient {
  return (
    !!p &&
    str(p.id, 64) &&
    str(p.name, 80) &&
    (p.sex === 'female' || p.sex === 'male') &&
    num(p.birthYear, [1900, 2100]) &&
    str(p.household, 80)
  );
}

function isVitals(v: any): v is Vitals {
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

/**
 * Parses a mesh message. The sender is an enrolled, MLS-authenticated phone,
 * but its content is still input: anything malformed is dropped, never repaired.
 */
export function parseWire(content: string): Wire | null {
  let m: any;
  try {
    m = JSON.parse(content);
  } catch {
    return null;
  }
  if (m?.t === 'ack') return str(m.id, 64) ? { t: 'ack', id: m.id } : null;
  if (m?.t !== 'visit') return null;
  const v = m.visit;
  const ok =
    !!v &&
    str(v.id, 64) &&
    isPatient(v.patient) &&
    isVitals(v.vitals) &&
    num(v.at, [0, 8.64e15]) &&
    str(v.chwName, 80);
  return ok
    ? {
        t: 'visit',
        visit: {
          id: v.id,
          patient: {
            id: v.patient.id,
            name: v.patient.name,
            sex: v.patient.sex,
            birthYear: v.patient.birthYear,
            household: v.patient.household,
          },
          vitals: {
            respRate: v.vitals.respRate,
            spo2: v.vitals.spo2,
            onOxygen: v.vitals.onOxygen,
            systolic: v.vitals.systolic,
            pulse: v.vitals.pulse,
            consciousness: v.vitals.consciousness,
            tempC: v.vitals.tempC,
          },
          at: v.at,
          chwName: v.chwName,
        },
      }
    : null;
}

/** Synthetic households. No real person is behind any of these. */
export const ROSTER: Patient[] = [
  {
    id: 'hh01-a',
    name: 'Amina Okello',
    sex: 'female',
    birthYear: 1958,
    household: 'Hillside 4',
  },
  {
    id: 'hh01-b',
    name: 'Joseph Okello',
    sex: 'male',
    birthYear: 1955,
    household: 'Hillside 4',
  },
  {
    id: 'hh02-a',
    name: 'Grace Mwangi',
    sex: 'female',
    birthYear: 1990,
    household: 'River Road 11',
  },
  {
    id: 'hh03-a',
    name: 'Peter Achieng',
    sex: 'male',
    birthYear: 1971,
    household: 'Market Lane 2',
  },
  {
    id: 'hh04-a',
    name: 'Ruth Njeri',
    sex: 'female',
    birthYear: 1946,
    household: 'Well Corner 7',
  },
  {
    id: 'hh05-a',
    name: 'Samuel Otieno',
    sex: 'male',
    birthYear: 1984,
    household: 'School Path 3',
  },
];

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
