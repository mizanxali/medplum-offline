import { visitOf } from './fhir';
import { isVitals, num, str, type Visit } from './visit';

export const ADDRESS_SYSTEM = 'urn:offline-protocol:address';
const VISITS_KEPT = 3;

/**
 * One patient on a panel: the FHIR Patient as Medplum last had it (kept whole,
 * because an edit sends it back), the chart in short, and recent visits.
 */
export type PanelPatient = {
  resource: any;
  problems: string[];
  allergies: string[];
  meds: string[];
  visits: Visit[];
};

/**
 * What a phone knows offline. `staff` maps a registered phone to its
 * Practitioner; only the clinic needs it, to give each worker their panel.
 */
export type Panel = {
  at: number;
  patients: PanelPatient[];
  staff: { address: string; practitioner: string }[];
};

// --- reading a Patient ---

export const nameOf = (p: any): string =>
  p?.name?.[0]?.text ||
  [p?.name?.[0]?.given?.join(' '), p?.name?.[0]?.family]
    .filter(Boolean)
    .join(' ') ||
  'Unnamed';
export const householdOf = (p: any): string => p?.address?.[0]?.text ?? '';
export const bornOf = (p: any): number =>
  Number(String(p?.birthDate).slice(0, 4));
export const versionOf = (p: any): string => p?.meta?.versionId ?? '';

const known = (x: unknown): x is string => typeof x === 'string' && !!x;
const text = (c: any): string | undefined =>
  c?.text ?? c?.coding?.find((x: any) => x?.display)?.display;
const isActive = (status: any) =>
  !status || status?.coding?.some((c: any) => c?.code === 'active');

/** Turns an offline snapshot (a FHIR searchset) into a panel. */
export function panelFromSnapshot(bundle: any, at = Date.now()): Panel {
  const all: any[] = (bundle?.entry ?? []).map((e: any) => e?.resource);
  const of = (t: string) => all.filter(r => r?.resourceType === t);
  const about = (r: any) => r?.subject?.reference ?? r?.patient?.reference;
  const forEncounter = (t: string, id: string) =>
    of(t).filter(
      r =>
        r.encounter?.reference === `Encounter/${id}` ||
        r.context?.encounter?.[0]?.reference === `Encounter/${id}`,
    );

  const patients = of('Patient').map(p => {
    const ref = `Patient/${p.id}`;
    const mine = (t: string) => of(t).filter(r => about(r) === ref);
    const visits = mine('Encounter')
      .map(e =>
        visitOf(
          e,
          forEncounter('Observation', e.id),
          forEncounter('DocumentReference', e.id),
        ),
      )
      .filter((v): v is Visit => !!v)
      .sort((a, b) => b.at - a.at)
      .slice(0, VISITS_KEPT);
    const { meta, ...resource } = p;
    return {
      resource: { ...resource, meta: { versionId: meta?.versionId } },
      problems: mine('Condition')
        .filter(c => isActive(c.clinicalStatus))
        .map(c => text(c.code))
        .filter(known),
      allergies: mine('AllergyIntolerance')
        .filter(a => isActive(a.clinicalStatus))
        .map(a => text(a.code))
        .filter(known),
      meds: mine('MedicationStatement')
        .filter(m => m.status === 'active')
        .map(m => m.dosage?.[0]?.text ?? text(m.medicationCodeableConcept))
        .filter(known),
      visits,
    };
  });

  const staff = of('Practitioner').flatMap(pr =>
    (pr.identifier ?? [])
      .filter((i: any) => i?.system === ADDRESS_SYSTEM && i.value)
      .map((i: any) => ({
        address: i.value,
        practitioner: `Practitioner/${pr.id}`,
      })),
  );

  patients.sort((a, b) => nameOf(a.resource).localeCompare(nameOf(b.resource)));
  return { at, patients, staff };
}

/** The clinic's panel cut down to one worker's patients, or null if that phone is not registered. */
export function panelFor(panel: Panel, address: string): Panel | null {
  const practitioner = panel.staff.find(
    s => s.address === address,
  )?.practitioner;
  if (!practitioner) return null;
  return {
    at: panel.at,
    staff: [],
    patients: panel.patients.filter(p =>
      p.resource.generalPractitioner?.some(
        (g: any) => g?.reference === practitioner,
      ),
    ),
  };
}

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter(x => str(x, 200)).slice(0, 50) : [];

function isVisit(v: any): v is Visit {
  return (
    !!v &&
    str(v.id, 64) &&
    str(v.patientId, 64) &&
    isVitals(v.vitals) &&
    num(v.at, [0, 8.64e15]) &&
    typeof v.by === 'string' &&
    typeof v.note === 'string'
  );
}

/** A panel from the clinic, checked field by field before the UI trusts it. */
export function parsePanel(m: any): Panel | null {
  if (!num(m?.at, [0, 8.64e15]) || !Array.isArray(m.patients)) return null;
  const patients = m.patients
    .filter(
      (p: any) =>
        p?.resource?.resourceType === 'Patient' &&
        str(p.resource.id, 64) &&
        str(p.resource.meta?.versionId, 64),
    )
    .map((p: any) => ({
      resource: p.resource,
      problems: strings(p.problems),
      allergies: strings(p.allergies),
      meds: strings(p.meds),
      visits: Array.isArray(p.visits)
        ? p.visits.filter(isVisit).slice(0, VISITS_KEPT)
        : [],
    }));
  return { at: m.at, patients, staff: [] };
}
