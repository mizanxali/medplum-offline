// NEWS2, the Royal College of Physicians' National Early Warning Score 2
// (2017), SpO2 scale 1. Validated for adults (16+); not for children or
// pregnancy. Every band below is the published chart, so a change here is a
// clinical change, not a refactor.

export type Consciousness = 'A' | 'C' | 'V' | 'P' | 'U';

export type Vitals = {
  respRate: number; // breaths/min
  spo2: number; // %
  onOxygen: boolean;
  systolic: number; // mmHg
  pulse: number; // beats/min
  consciousness: Consciousness;
  tempC: number;
};

export type Risk = 'low' | 'low-medium' | 'medium' | 'high';

export type News2 = {
  total: number;
  risk: Risk;
  parts: Record<keyof Vitals, number>;
};

const respRate = (v: number) =>
  v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3;
const spo2 = (v: number) => (v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0);
const systolic = (v: number) =>
  v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3;
const pulse = (v: number) =>
  v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3;
const temp = (v: number) =>
  v <= 35.0 ? 3 : v <= 36.0 ? 1 : v <= 38.0 ? 0 : v <= 39.0 ? 1 : 2;

export function news2(v: Vitals): News2 {
  const parts = {
    respRate: respRate(v.respRate),
    spo2: spo2(v.spo2),
    onOxygen: v.onOxygen ? 2 : 0,
    systolic: systolic(v.systolic),
    pulse: pulse(v.pulse),
    consciousness: v.consciousness === 'A' ? 0 : 3,
    tempC: temp(v.tempC),
  };
  const scores = Object.values(parts);
  const total = scores.reduce((a, b) => a + b, 0);
  // A 3 in any single parameter escalates on its own, even when the total is low.
  const risk: Risk =
    total >= 7
      ? 'high'
      : total >= 5
      ? 'medium'
      : scores.includes(3)
      ? 'low-medium'
      : 'low';
  return { total, risk, parts };
}

/** What a community health worker does with the score. */
export const ACTION: Record<Risk, string> = {
  low: 'Routine follow-up',
  'low-medium': 'Refer today',
  medium: 'Urgent referral',
  high: 'Emergency transfer',
};
