/// <reference types="node" />
import {
  createPublicKey,
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
} from 'crypto';
import {
  openEnvelope,
  signEnvelope,
  type Signer,
} from '../src/domain/envelope';
import {
  householdBundle,
  readBundle,
  SYSTEM,
  visitBundle,
} from '../src/domain/fhir';
import { news2 } from '../src/domain/news2';
import {
  ADDRESS_SYSTEM,
  panelFor,
  panelFromSnapshot,
  parsePanel,
} from '../src/domain/panel';
import { NORMAL, parseWire, type Visit } from '../src/domain/visit';

const visit: Visit = {
  id: 'v-1',
  patientId: 'p-1',
  vitals: { ...NORMAL, pulse: 112, tempC: 38.6 },
  at: Date.parse('2026-10-30T09:00:00Z'),
  by: 'Ada Wanjiru',
  note: 'Fever since yesterday. Drinking well. Ünïcode ok.',
};
const ada = { reference: 'Practitioner/ada', display: 'Ada Wanjiru' };

/** The SDK's identity, played by Node's Ed25519. */
function phone(): Signer & { address: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = [
    ...publicKey.export({ format: 'der', type: 'spki' }).subarray(12),
  ];
  const derive = (k: number[]) =>
    'off1' + Buffer.from(k).toString('hex').slice(0, 16);
  return {
    address: derive(raw),
    signData: async d => [...edSign(null, Buffer.from(d), privateKey)],
    verifySignature: async (k, d, sig) =>
      edVerify(
        null,
        Buffer.from(d),
        createPublicKey({
          key: Buffer.concat([
            Buffer.from('302a300506032b6570032100', 'hex'),
            Buffer.from(k),
          ]),
          format: 'der',
          type: 'spki',
        }),
        Buffer.from(sig),
      ),
    getIdentityPublicKey: async () => raw,
    deriveAddress: async k => derive(k),
  };
}

describe('news2', () => {
  it('scores normal adult vitals 0, low risk', () => {
    expect(news2(NORMAL)).toMatchObject({ total: 0, risk: 'low' });
  });

  it('band edges match the published chart', () => {
    const at = (patch: object) => news2({ ...NORMAL, ...patch }).total;
    expect(
      [8, 9, 11, 12, 20, 21, 24, 25].map(respRate => at({ respRate })),
    ).toEqual([3, 1, 1, 0, 0, 2, 2, 3]);
    expect([91, 92, 93, 94, 95, 96].map(spo2 => at({ spo2 }))).toEqual([
      3, 2, 2, 1, 1, 0,
    ]);
    expect(
      [90, 91, 100, 101, 110, 111, 219, 220].map(systolic => at({ systolic })),
    ).toEqual([3, 2, 2, 1, 1, 0, 0, 3]);
    expect(
      [40, 41, 50, 51, 90, 91, 110, 111, 130, 131].map(pulse => at({ pulse })),
    ).toEqual([3, 1, 1, 0, 0, 1, 1, 2, 2, 3]);
    expect(
      [35.0, 35.1, 36.0, 36.1, 38.0, 38.1, 39.0, 39.1].map(tempC =>
        at({ tempC }),
      ),
    ).toEqual([3, 1, 1, 0, 0, 1, 1, 2]);
    expect(at({ onOxygen: true })).toBe(2);
    expect(at({ consciousness: 'V' })).toBe(3);
  });

  it('a single 3 is low-medium; 5 is medium; 7 is high', () => {
    expect(news2({ ...NORMAL, consciousness: 'C' }).risk).toBe('low-medium');
    expect(
      news2({ ...NORMAL, respRate: 22, pulse: 115, tempC: 38.5 }).risk,
    ).toBe('medium');
    expect(
      news2({ ...NORMAL, respRate: 26, spo2: 90, pulse: 120 }),
    ).toMatchObject({ total: 8, risk: 'high' });
  });
});

describe('parseWire', () => {
  const env = { body: '{"id":"x"}', sig: 'c2ln', key: 'a2V5' };

  it('round-trips a record and a receipt', () => {
    expect(parseWire(JSON.stringify({ t: 'env', env }))).toEqual({
      t: 'env',
      env,
    });
    expect(parseWire('{"t":"ack","id":"v-1"}')).toEqual({
      t: 'ack',
      id: 'v-1',
    });
    expect(
      parseWire('{"t":"ack","id":"v-1","synced":"conflict","reason":"newer"}'),
    ).toEqual({
      t: 'ack',
      id: 'v-1',
      synced: 'conflict',
      reason: 'newer',
    });
  });

  it('drops malformed content and extra fields', () => {
    expect(parseWire('not json')).toBeNull();
    expect(parseWire('{"t":"ack"}')).toBeNull();
    expect(
      parseWire(JSON.stringify({ t: 'env', env: { ...env, sig: 5 } })),
    ).toBeNull();
    expect(parseWire('{"t":"visit","visit":{}}')).toBeNull();
    const extra = parseWire(
      JSON.stringify({ t: 'env', env: { ...env, evil: 1 } }),
    );
    expect(extra && 'evil' in (extra as any).env).toBe(false);
  });
});

describe('envelopes', () => {
  it('opens only what the sender signed, byte for byte', async () => {
    const ada = phone();
    const eve = phone();
    const env = await signEnvelope(ada, 'e-1', visitBundle(visit, null));
    expect((await openEnvelope(eve, env, ada.address))?.id).toBe('e-1');
    // Another phone's key, a changed body, or a body under someone else's name: refused.
    expect(await openEnvelope(eve, env, eve.address)).toBeNull();
    expect(
      await openEnvelope(
        eve,
        { ...env, body: env.body.replace('112', '72') },
        ada.address,
      ),
    ).toBeNull();
    const forged = { ...env, key: (await signEnvelope(eve, 'e-1', {})).key };
    expect(await openEnvelope(eve, forged, eve.address)).toBeNull();
  });
});

describe('visitBundle', () => {
  const bundle = visitBundle(visit, ada) as any;

  it('makes every create conditional on a stable identifier', () => {
    for (const e of bundle.entry) {
      const [id] = e.resource.identifier;
      expect(e.request.method).toBe('POST');
      expect(e.request.ifNoneExist).toBe(`identifier=${id.system}|${id.value}`);
    }
    expect(bundle.entry[0].resource.identifier[0]).toEqual({
      system: SYSTEM.visit,
      value: 'v-1',
    });
  });

  it('files the visit under the Medplum patient and the signing practitioner', () => {
    const [encounter, ...rest] = bundle.entry;
    expect(rest).toHaveLength(3); // vital signs, NEWS2 and the note
    expect(encounter.resource.subject.reference).toBe('Patient/p-1');
    expect(encounter.resource.participant[0].individual).toEqual(ada);
    for (const o of rest.slice(0, 2)) {
      expect(o.resource.encounter.reference).toBe(encounter.fullUrl);
    }
    expect(rest[2].resource.context.encounter[0].reference).toBe(
      encounter.fullUrl,
    );
    expect(visitBundle({ ...visit, note: '' }, ada).entry).toHaveLength(3);
  });

  it('reads back exactly what it records', () => {
    expect(readBundle(bundle)).toEqual({ visit });
  });

  it('edits a household only on the version the phone saw', () => {
    const patient = {
      resourceType: 'Patient',
      id: 'p-1',
      meta: { versionId: 'v7' },
      name: [{ text: 'A' }],
    };
    const edit = householdBundle(patient, 'River Road 12') as any;
    expect(edit.entry[0].request).toEqual({
      method: 'PUT',
      url: 'Patient/p-1',
      ifMatch: 'W/"v7"',
    });
    expect(edit.entry[0].resource.meta).toBeUndefined();
    expect(readBundle(edit)).toEqual({
      edit: { patientId: 'p-1', household: 'River Road 12', base: 'v7' },
    });
  });
});

describe('panels', () => {
  // A snapshot as Medplum returns it: the signed visit, stored, plus the chart around it.
  const snapshot = (encounterId: string) => {
    const stored = (visitBundle(visit, ada) as any).entry.map((e: any) =>
      JSON.parse(
        JSON.stringify(e.resource).replace(
          /urn:uuid:[0-9a-f-]+/g,
          `Encounter/${encounterId}`,
        ),
      ),
    );
    const [encounter, ...others] = stored;
    encounter.id = encounterId;
    return {
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'p-1',
            meta: { versionId: 'v7', lastUpdated: 'x' },
            name: [{ text: 'Amina Okello' }],
            address: [{ text: 'Hillside 4' }],
            generalPractitioner: [
              { reference: 'Practitioner/ada' },
              { reference: 'Practitioner/clinic' },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Practitioner',
            id: 'ada',
            identifier: [{ system: ADDRESS_SYSTEM, value: 'off1ada' }],
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            subject: { reference: 'Patient/p-1' },
            code: { text: 'Hypertension' },
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            subject: { reference: 'Patient/p-1' },
            code: { text: 'Old cough' },
            clinicalStatus: { coding: [{ code: 'resolved' }] },
          },
        },
        {
          resource: {
            resourceType: 'AllergyIntolerance',
            patient: { reference: 'Patient/p-1' },
            code: { text: 'Penicillin' },
          },
        },
        {
          resource: {
            resourceType: 'MedicationStatement',
            status: 'active',
            subject: { reference: 'Patient/p-1' },
            dosage: [{ text: 'Amlodipine 5 mg once daily' }],
          },
        },
        { resource: encounter },
        ...others.map((resource: any) => ({ resource })),
      ],
    };
  };

  it('turns a snapshot into a chart with recent visits', () => {
    const panel = panelFromSnapshot(snapshot('e1'), 5);
    expect(panel.at).toBe(5);
    const [p] = panel.patients;
    expect(p.resource.meta).toEqual({ versionId: 'v7' });
    expect(p.problems).toEqual(['Hypertension']);
    expect(p.allergies).toEqual(['Penicillin']);
    expect(p.meds).toEqual(['Amlodipine 5 mg once daily']);
    expect(p.visits).toEqual([visit]);
    expect(panel.staff).toEqual([
      { address: 'off1ada', practitioner: 'Practitioner/ada' },
    ]);
  });

  it('gives each registered worker only their own patients', () => {
    const panel = panelFromSnapshot(snapshot('e1'));
    expect(panelFor(panel, 'off1ada')?.patients).toHaveLength(1);
    expect(panelFor(panel, 'off1ada')?.staff).toEqual([]);
    expect(panelFor(panel, 'off1eve')).toBeNull();
  });

  it('checks a panel from the mesh before the UI sees it', () => {
    const panel = panelFromSnapshot(snapshot('e1'));
    expect(
      parsePanel(JSON.parse(JSON.stringify(panel)))?.patients,
    ).toHaveLength(1);
    expect(
      parsePanel({
        at: 1,
        patients: [{ resource: { resourceType: 'Patient', id: 'x' } }],
      })?.patients,
    ).toEqual([]);
    expect(parsePanel({ at: 'soon', patients: [] })).toBeNull();
    const bad = JSON.parse(JSON.stringify(panel));
    bad.patients[0].visits[0].vitals.spo2 = 400;
    bad.patients[0].problems = ['ok', 7];
    expect(parsePanel(bad)?.patients[0]).toMatchObject({
      visits: [],
      problems: ['ok'],
    });
  });
});
