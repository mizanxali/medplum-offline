// Seeds the WeCare demo into the local Medplum: two access policies, Ada (a
// health worker) and the clinic as Practitioners who can sign in, the six
// synthetic patients on their panels, and a few chart entries. Every write is
// a conditional PUT, so it is safe to run again.
//
//   MEDPLUM_ADMIN_EMAIL=... MEDPLUM_ADMIN_PASSWORD=... \
//   ADA_PASSWORD=... CLINIC_PASSWORD=... node wecare/medplum/seed.mjs
//
// Every person and record here is synthetic.

const env = process.env;
const BASE = env.MEDPLUM_BASE_URL ?? 'http://localhost:8103/';
const PROJECT = env.WECARE_PROJECT_ID ?? '5450af3d-0961-456b-a193-2163ba1698a9';
for (const k of ['MEDPLUM_ADMIN_EMAIL', 'MEDPLUM_ADMIN_PASSWORD', 'ADA_PASSWORD', 'CLINIC_PASSWORD']) {
  if (!env[k]) throw new Error(`Set ${k}`);
}

let token = '';

async function call(method, path, body) {
  const res = await fetch(new URL(path, BASE), {
    method,
    headers: {
      'content-type': 'application/fhir+json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const why = json?.issue?.map(i => i.details?.text ?? i.diagnostics).join('; ');
    throw Object.assign(new Error(`${method} ${path}: ${res.status} ${why ?? ''}`), { status: res.status });
  }
  return json;
}

const form = body =>
  fetch(new URL('oauth2/token', BASE), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  }).then(r => r.json());

/** Creates or replaces the one resource matching `query`, inside the WeCare project. */
const upsert = (resource, query) =>
  call('PUT', `fhir/R4/${resource.resourceType}?${query}`, { ...resource, meta: { project: PROJECT } });

// --- sign in as the super admin (Medplum wants PKCE; plain is enough for a one-off script) ---
const verifier = crypto.randomUUID() + crypto.randomUUID();
const { code } = await call('POST', 'auth/login', {
  email: env.MEDPLUM_ADMIN_EMAIL,
  password: env.MEDPLUM_ADMIN_PASSWORD,
  scope: 'openid',
  codeChallenge: verifier,
  codeChallengeMethod: 'plain',
});
token = (await form({ grant_type: 'authorization_code', code, code_verifier: verifier })).access_token;
if (!token) throw new Error('Super admin sign-in failed');

// --- the project checks every reference a member writes against what they may read ---
const project = await call('GET', `fhir/R4/Project/${PROJECT}`);
if (!project.checkReferencesOnWrite) {
  await call('PUT', `fhir/R4/Project/${PROJECT}`, { ...project, checkReferencesOnWrite: true });
}

// --- access policies ---
const READ = ['read', 'search', 'vread', 'history'];
const WRITE_ONCE = [...READ, 'create'];
const policy = (name, patient) => ({
  resourceType: 'AccessPolicy',
  name,
  resource: [
    { resourceType: 'Patient', interaction: [...READ, 'update'], ...(patient && { criteria: patient }) },
    { resourceType: 'Practitioner', readonly: true },
    { resourceType: 'Encounter', interaction: WRITE_ONCE },
    { resourceType: 'Observation', interaction: WRITE_ONCE },
    { resourceType: 'DocumentReference', interaction: WRITE_ONCE },
    { resourceType: 'Condition', readonly: true },
    { resourceType: 'AllergyIntolerance', readonly: true },
    { resourceType: 'MedicationStatement', readonly: true },
    { resourceType: 'Provenance', interaction: ['create', 'read', 'search'] },
  ],
});
const workerPolicy = await upsert(
  policy('WeCare health worker', 'Patient?general-practitioner=%profile'),
  'name=WeCare health worker',
);
const clinicPolicy = await upsert(policy('WeCare clinic'), 'name=WeCare clinic');

// --- staff: a Practitioner, a User and a membership each ---
async function staff(email, firstName, lastName, password, accessPolicy) {
  try {
    await call('POST', `admin/projects/${PROJECT}/invite`, {
      resourceType: 'Practitioner',
      email,
      firstName,
      lastName,
      password,
      sendEmail: false,
      membership: { accessPolicy: { reference: `AccessPolicy/${accessPolicy.id}` } },
    });
  } catch (e) {
    if (e.status !== 409) throw e; // already a member
  }
  const [user] = (await call('GET', `fhir/R4/User?email=${encodeURIComponent(email)}`)).entry ?? [];
  const membership = (
    await call('GET', `fhir/R4/ProjectMembership?user=User/${user.resource.id}&project=Project/${PROJECT}`)
  ).entry[0].resource;
  return { reference: membership.profile.reference, display: `${firstName} ${lastName}` };
}

const ada = await staff('ada@wecare.local', 'Ada', 'Wanjiru', env.ADA_PASSWORD, workerPolicy);
const clinic = await staff('clinic@wecare.local', 'Hillside', 'Clinic', env.CLINIC_PASSWORD, clinicPolicy);

// --- patients: Ada looks after five of them, the clinic after all six ---
const PATIENTS = [
  ['hh01-a', 'Amina Okello', 'female', 1958, 'Hillside 4', true],
  ['hh01-b', 'Joseph Okello', 'male', 1955, 'Hillside 4', true],
  ['hh02-a', 'Grace Mwangi', 'female', 1990, 'River Road 11', true],
  ['hh03-a', 'Peter Achieng', 'male', 1971, 'Market Lane 2', true],
  ['hh04-a', 'Ruth Njeri', 'female', 1946, 'Well Corner 7', true],
  ['hh05-a', 'Samuel Otieno', 'male', 1984, 'School Path 3', false],
];

const CHART = {
  'hh01-a': { conditions: ['Hypertension'], meds: ['Amlodipine 5 mg once daily'], allergies: ['Penicillin'] },
  'hh01-b': { conditions: ['Type 2 diabetes'], meds: ['Metformin 500 mg twice daily'] },
  'hh02-a': { conditions: ['Asthma'], meds: ['Salbutamol inhaler as needed'] },
  'hh03-a': { allergies: ['Sulfonamides'] },
  'hh04-a': { conditions: ['Heart failure'], meds: ['Furosemide 40 mg once daily'] },
};

const active = (system, code) => ({ coding: [{ system, code }] });
const chartId = (key, kind, i) => `identifier=urn:wecare:chart|${key}-${kind}-${i}`;

for (const [key, name, gender, born, household, onAdaPanel] of PATIENTS) {
  const patient = await upsert(
    {
      resourceType: 'Patient',
      identifier: [{ system: 'urn:wecare:patient', value: key }],
      name: [{ text: name }],
      gender,
      birthDate: String(born),
      address: [{ text: household }],
      generalPractitioner: onAdaPanel ? [ada, clinic] : [clinic],
    },
    `identifier=urn:wecare:patient|${key}`,
  );
  const subject = { reference: `Patient/${patient.id}`, display: name };
  const chart = CHART[key] ?? {};
  for (const [i, text] of (chart.conditions ?? []).entries()) {
    await upsert(
      {
        resourceType: 'Condition',
        identifier: [{ system: 'urn:wecare:chart', value: `${key}-condition-${i}` }],
        clinicalStatus: active('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active'),
        code: { text },
        subject,
      },
      chartId(key, 'condition', i),
    );
  }
  for (const [i, text] of (chart.allergies ?? []).entries()) {
    await upsert(
      {
        resourceType: 'AllergyIntolerance',
        identifier: [{ system: 'urn:wecare:chart', value: `${key}-allergy-${i}` }],
        clinicalStatus: active('http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', 'active'),
        code: { text },
        patient: subject,
      },
      chartId(key, 'allergy', i),
    );
  }
  for (const [i, text] of (chart.meds ?? []).entries()) {
    await upsert(
      {
        resourceType: 'MedicationStatement',
        identifier: [{ system: 'urn:wecare:chart', value: `${key}-med-${i}` }],
        status: 'active',
        medicationCodeableConcept: { text: text.split(' ')[0] },
        dosage: [{ text }],
        subject,
      },
      chartId(key, 'med', i),
    );
  }
}

console.log(`Seeded: ${ada.display} (${ada.reference}), ${clinic.display} (${clinic.reference}), ${PATIENTS.length} patients.`);
