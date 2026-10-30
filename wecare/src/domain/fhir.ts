import { news2, type Consciousness, type Vitals } from './news2';
import { isVitals, newId, NOTE_MAX, type Visit } from './visit';

// Identifier systems for this demo. The visit id becomes the Encounter's
// identifier, and every create is conditional on it, so the server, not the
// phone, is what refuses a second copy of the same visit.
export const SYSTEM = {
  patient: 'urn:wecare:patient',
  visit: 'urn:wecare:visit',
  observation: 'urn:wecare:observation',
  note: 'urn:wecare:note',
  code: 'urn:wecare:code',
};

const LOINC = 'http://loinc.org';
const UCUM = 'http://unitsofmeasure.org';

export type Ref = { reference?: string; display?: string };

// UTF-8 through base64 without TextDecoder, which Hermes may lack.
export const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
export const fromBase64 = (b: string) => decodeURIComponent(escape(atob(b)));

type Component = {
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  [value: string]: unknown;
};

const component = (
  system: string,
  code: string,
  display: string,
  value: Record<string, unknown>,
): Component => ({
  code: { coding: [{ system, code, display }], text: display },
  ...value,
});

const quantity = (value: number, unit: string, code: string) => ({
  valueQuantity: { value, unit, system: UCUM, code },
});

/** The seven NEWS2 inputs, as components of one vital-signs Observation. */
function components(v: Vitals): Component[] {
  return [
    component(LOINC, '9279-1', 'Respiratory rate', quantity(v.respRate, 'breaths/min', '/min')),
    component(LOINC, '59408-5', 'Oxygen saturation by pulse oximetry', quantity(v.spo2, '%', '%')),
    component(LOINC, '8480-6', 'Systolic blood pressure', quantity(v.systolic, 'mmHg', 'mm[Hg]')),
    component(LOINC, '8867-4', 'Heart rate', quantity(v.pulse, 'beats/min', '/min')),
    component(LOINC, '8310-5', 'Body temperature', quantity(v.tempC, 'C', 'Cel')),
    // No LOINC code is claimed for these two; they use the demo's own system.
    component(SYSTEM.code, 'supplemental-oxygen', 'On supplemental oxygen', {
      valueBoolean: v.onOxygen,
    }),
    component(SYSTEM.code, 'acvpu', 'Level of consciousness (ACVPU)', {
      valueString: v.consciousness,
    }),
  ];
}

/**
 * One FHIR R4 transaction for one visit: the Encounter, its Observations and
 * the note, all conditional creates. The patient already lives in Medplum.
 */
export function visitBundle(visit: Visit, author: Ref | null) {
  const encounterUrl = `urn:uuid:${newId()}`;
  const when = new Date(visit.at).toISOString();
  const subject = { reference: `Patient/${visit.patientId}` };
  const by = {
    ...(author?.reference && { reference: author.reference }),
    display: visit.by,
  };

  const entry: unknown[] = [
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
        subject,
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

  // Two Observations, not one per vital: Medplum caps a transaction that needs
  // strict isolation (any conditional create does) at 8 entries.
  const score = news2(visit.vitals);
  const vitalsUrl = `urn:uuid:${newId()}`;
  const observation = (
    key: string,
    fullUrl: string,
    code: Component['code'],
    rest: Record<string, unknown>,
  ) => ({
    fullUrl,
    resource: {
      resourceType: 'Observation',
      identifier: [{ system: SYSTEM.observation, value: `${visit.id}/${key}` }],
      status: 'final',
      code,
      subject,
      encounter: { reference: encounterUrl },
      effectiveDateTime: when,
      performer: [by],
      ...rest,
    },
    request: {
      method: 'POST',
      url: 'Observation',
      ifNoneExist: `identifier=${SYSTEM.observation}|${visit.id}/${key}`,
    },
  });
  entry.push(
    observation(
      'vitals',
      vitalsUrl,
      {
        coding: [{ system: LOINC, code: '85353-1', display: 'Vital signs panel' }],
        text: 'Vital signs',
      },
      {
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              },
            ],
          },
        ],
        component: components(visit.vitals),
      },
    ),
    observation(
      'news2',
      `urn:uuid:${newId()}`,
      {
        coding: [{ system: SYSTEM.code, code: 'news2', display: 'NEWS2 total score' }],
        text: 'NEWS2 total score',
      },
      {
        valueInteger: score.total,
        interpretation: [{ text: `${score.risk} risk` }],
        derivedFrom: [{ reference: vitalsUrl }],
      },
    ),
  );

  if (visit.note) {
    entry.push({
      fullUrl: `urn:uuid:${newId()}`,
      resource: {
        resourceType: 'DocumentReference',
        identifier: [{ system: SYSTEM.note, value: visit.id }],
        status: 'current',
        type: {
          coding: [
            { system: LOINC, code: '11506-3', display: 'Progress note' },
          ],
          text: 'Visit note',
        },
        subject,
        date: when,
        author: [by],
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              data: toBase64(visit.note.slice(0, NOTE_MAX)),
            },
          },
        ],
        context: { encounter: [{ reference: encounterUrl }] },
      },
      request: {
        method: 'POST',
        url: 'DocumentReference',
        ifNoneExist: `identifier=${SYSTEM.note}|${visit.id}`,
      },
    });
  }

  return { resourceType: 'Bundle', type: 'transaction', entry };
}

/** The household edit: the whole Patient back, only if Medplum still has the version this phone saw. */
export function householdBundle(patient: any, household: string) {
  const { meta, ...rest } = patient;
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        resource: { ...rest, address: [{ text: household }] },
        request: {
          method: 'PUT',
          url: `Patient/${patient.id}`,
          ifMatch: `W/"${meta.versionId}"`,
        },
      },
    ],
  };
}

const LOINC_KEY: Record<string, keyof Vitals> = {
  '9279-1': 'respRate',
  '59408-5': 'spo2',
  '8480-6': 'systolic',
  '8867-4': 'pulse',
  '8310-5': 'tempC',
};

/** Vitals back out of the Observations; null unless every one is there and plausible. */
function vitalsFrom(obs: any[]): Vitals | null {
  const v: Record<string, unknown> = {};
  for (const o of obs.flatMap(x => [x, ...(x?.component ?? [])])) {
    const c = o?.code?.coding?.[0];
    const key = c?.system === LOINC ? LOINC_KEY[c.code] : undefined;
    if (key) v[key] = o.valueQuantity?.value;
    if (c?.system === SYSTEM.code && c.code === 'supplemental-oxygen')
      v.onOxygen = o.valueBoolean;
    if (c?.system === SYSTEM.code && c.code === 'acvpu')
      v.consciousness = o.valueString as Consciousness;
  }
  return isVitals(v) ? v : null;
}

function noteFrom(docs: any[]): string {
  const data = docs[0]?.content?.[0]?.attachment?.data;
  try {
    return typeof data === 'string' ? fromBase64(data).slice(0, NOTE_MAX) : '';
  } catch {
    return '';
  }
}

/** A visit from its Encounter, Observations and note, as stored or as signed. */
export function visitOf(encounter: any, obs: any[], docs: any[]): Visit | null {
  const vitals = vitalsFrom(obs);
  const at = Date.parse(encounter?.period?.start);
  const patientId = encounter?.subject?.reference?.split('/')[1];
  if (!vitals || Number.isNaN(at) || typeof patientId !== 'string') return null;
  const id =
    encounter.identifier?.find((i: any) => i.system === SYSTEM.visit)?.value ??
    encounter.id;
  if (typeof id !== 'string') return null;
  return {
    id,
    patientId,
    vitals,
    at,
    by: String(encounter.participant?.[0]?.individual?.display ?? '').slice(
      0,
      80,
    ),
    note: noteFrom(docs),
  };
}

export type Edit = { patientId: string; household: string; base: string };

/** What a signed bundle does: records a visit, or edits a household. */
export function readBundle(bundle: any): { visit?: Visit; edit?: Edit } {
  const resources = (bundle?.entry ?? []).map((e: any) => e?.resource);
  const of = (t: string) => resources.filter((r: any) => r?.resourceType === t);
  const [encounter] = of('Encounter');
  if (encounter) {
    const visit = visitOf(
      encounter,
      of('Observation'),
      of('DocumentReference'),
    );
    return visit ? { visit } : {};
  }
  const put = bundle?.entry?.[0];
  const household = put?.resource?.address?.[0]?.text;
  const base = /^W\/"(.+)"$/.exec(put?.request?.ifMatch ?? '')?.[1];
  if (
    put?.resource?.resourceType === 'Patient' &&
    typeof household === 'string' &&
    base
  ) {
    return { edit: { patientId: put.resource.id, household, base } };
  }
  return {};
}
