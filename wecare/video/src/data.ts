import { news2, type Vitals } from "../../src/domain/news2";
import { NORMAL, ROSTER, type Patient } from "../../src/domain/visit";

// The app's own scoring and synthetic roster, imported rather than copied.
export { ACTION, news2 } from "../../src/domain/news2";
export { NORMAL };
export type { Vitals };

const who = (name: string): Patient => ROSTER.find((p) => p.name === name)!;
export const RUTH = who("Ruth Njeri");
export const SAMUEL = who("Samuel Otieno");
export const PETER = who("Peter Achieng");
export const GRACE = who("Grace Mwangi");
export const JOSEPH = who("Joseph Okello");
export { ROSTER };

export const ADA = { name: "Ada", address: "off1q964…4trw" };
export const BEN = { name: "Ben", address: "off1qk7r…2fxa" };
export const CLINIC = { name: "Riverside Clinic", address: "off1qx3l…m9c2" };

// The visit form's presets (src/ui/VisitForm.tsx).
export const FEVERISH: Vitals = { ...NORMAL, respRate: 22, pulse: 112, tempC: 38.6 };
export const DETERIORATING: Vitals = {
  respRate: 27,
  spo2: 90,
  onOxygen: false,
  systolic: 96,
  pulse: 124,
  consciousness: "C",
  tempC: 39.4,
};

export type Ehr = "pending" | "added" | "already";

/** A visit as the screens show it. */
export type VisitView = {
  patient: Patient;
  vitals: Vitals;
  from: string;
  hops: number;
  at: string;
  ehr: Ehr;
};

export const visit = (patient: Patient, vitals: Vitals, from: string, hops: number, at: string, ehr: Ehr = "pending"): VisitView => ({
  patient,
  vitals,
  from,
  hops,
  at,
  ehr,
});

// Already on the clinic's list when the video starts.
export const EARLIER = [
  visit(SAMUEL, FEVERISH, BEN.name, 0, "09:58"),
  visit(PETER, { ...NORMAL, spo2: 91 }, ADA.name, 0, "09:21"),
  visit(GRACE, NORMAL, BEN.name, 1, "08:47"),
];
export const RUTH_VISIT = visit(RUTH, DETERIORATING, ADA.name, 1, "10:42");
export const JOSEPH_VISIT = visit(JOSEPH, { ...NORMAL, respRate: 22, pulse: 112, spo2: 94, tempC: 38.6 }, BEN.name, 0, "10:47");

const SEVERITY = { high: 3, medium: 2, "low-medium": 1, low: 0 };
/** Sickest first, then newest, as the clinic sorts them. */
export const sickestFirst = (vs: VisitView[]) =>
  [...vs].sort((a, b) => SEVERITY[news2(b.vitals).risk] - SEVERITY[news2(a.vitals).risk] || b.at.localeCompare(a.at));
