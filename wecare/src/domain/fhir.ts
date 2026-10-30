import { news2, type Vitals } from './news2';
import { newId, type Visit } from './visit';

// Identifier systems for this demo. The visit id becomes the Encounter's
// identifier, and every create is conditional on it, so the server, not the
// phone, is what refuses a second copy of the same visit.
export const SYSTEM = {
  patient: 'urn:wecare:patient',
  visit: 'urn:wecare:visit',
  observation: 'urn:wecare:observation',
  code: 'urn:wecare:code',
};

const LOINC = 'http://loinc.org';
const UCUM = 'http://unitsofmeasure.org';

type Obs = {
  key: string;
  code: { system: string; code: string; display: string };
  value: Record<string, unknown>;
  vital: boolean;
};

const quantity = (value: number, unit: string, code: string) => ({
  valueQuantity: { value, unit, system: UCUM, code },
});

function observations(v: Vitals): Obs[] {
  const score = news2(v);
  return [
    {
      key: 'resp',
      vital: true,
      code: { system: LOINC, code: '9279-1', display: 'Respiratory rate' },
      value: quantity(v.respRate, 'breaths/min', '/min'),
    },
    {
      key: 'spo2',
      vital: true,
      code: {
        system: LOINC,
        code: '59408-5',
        display: 'Oxygen saturation by pulse oximetry',
      },
      value: quantity(v.spo2, '%', '%'),
    },
    {
      key: 'sbp',
      vital: true,
      code: {
        system: LOINC,
        code: '8480-6',
        display: 'Systolic blood pressure',
      },
      value: quantity(v.systolic, 'mmHg', 'mm[Hg]'),
    },
    {
      key: 'hr',
      vital: true,
      code: { system: LOINC, code: '8867-4', display: 'Heart rate' },
      value: quantity(v.pulse, 'beats/min', '/min'),
    },
    {
      key: 'temp',
      vital: true,
      code: { system: LOINC, code: '8310-5', display: 'Body temperature' },
      value: quantity(v.tempC, 'C', 'Cel'),
    },
    // No LOINC code is claimed for these three; they use the demo's own system.
    {
      key: 'o2',
      vital: false,
      code: {
        system: SYSTEM.code,
        code: 'supplemental-oxygen',
        display: 'On supplemental oxygen',
      },
      value: { valueBoolean: v.onOxygen },
    },
    {
      key: 'acvpu',
      vital: false,
      code: {
        system: SYSTEM.code,
        code: 'acvpu',
        display: 'Level of consciousness (ACVPU)',
      },
      value: { valueString: v.consciousness },
    },
    {
      key: 'news2',
      vital: false,
      code: {
        system: SYSTEM.code,
        code: 'news2',
        display: 'NEWS2 total score',
      },
      value: {
        valueInteger: score.total,
        interpretation: [{ text: `${score.risk} risk` }],
      },
    },
  ];
}

/** One FHIR R4 transaction for one visit: Patient, Encounter, Observations, all conditional creates. */
export function visitBundle(visit: Visit) {
  const p = visit.patient;
  const patientUrl = `urn:uuid:${newId()}`;
  const encounterUrl = `urn:uuid:${newId()}`;
  const when = new Date(visit.at).toISOString();
  const by = { display: `${visit.chwName} (community health worker)` };

  const entry: unknown[] = [
    {
      fullUrl: patientUrl,
      resource: {
        resourceType: 'Patient',
        identifier: [{ system: SYSTEM.patient, value: p.id }],
        name: [{ text: p.name }],
        gender: p.sex,
        birthDate: String(p.birthYear),
        address: [{ text: p.household }],
      },
      request: {
        method: 'POST',
        url: 'Patient',
        ifNoneExist: `identifier=${SYSTEM.patient}|${p.id}`,
      },
    },
    {
      fullUrl: encounterUrl,
      resource: {
        resourceType: 'Encounter',
        identifier: [{ system: SYSTEM.visit, value: visit.id }],
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'HH',
          display: 'home health',
        },
        subject: { reference: patientUrl },
        participant: [{ individual: by }],
        period: { start: when, end: when },
      },
      request: {
        method: 'POST',
        url: 'Encounter',
        ifNoneExist: `identifier=${SYSTEM.visit}|${visit.id}`,
      },
    },
  ];

  for (const o of observations(visit.vitals)) {
    const id = `${visit.id}/${o.key}`;
    entry.push({
      fullUrl: `urn:uuid:${newId()}`,
      resource: {
        resourceType: 'Observation',
        identifier: [{ system: SYSTEM.observation, value: id }],
        status: 'final',
        ...(o.vital && {
          category: [
            {
              coding: [
                {
                  system:
                    'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                },
              ],
            },
          ],
        }),
        code: { coding: [o.code], text: o.code.display },
        subject: { reference: patientUrl },
        encounter: { reference: encounterUrl },
        effectiveDateTime: when,
        performer: [by],
        ...o.value,
      },
      request: {
        method: 'POST',
        url: 'Observation',
        ifNoneExist: `identifier=${SYSTEM.observation}|${id}`,
      },
    });
  }

  return { resourceType: 'Bundle', type: 'transaction', entry };
}

/**
 * Reads the transaction response. The Encounter is entry 1: `201` means this
 * call created the visit, `200` means the server already had it.
 */
export function visitOutcome(response: any): 'added' | 'duplicate' | null {
  const status: unknown = response?.entry?.[1]?.response?.status;
  if (typeof status !== 'string') return null;
  if (status.startsWith('201')) return 'added';
  if (status.startsWith('200')) return 'duplicate';
  return null;
}
