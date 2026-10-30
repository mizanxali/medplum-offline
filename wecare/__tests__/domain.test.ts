import { visitBundle, visitOutcome, SYSTEM } from '../src/domain/fhir';
import { news2 } from '../src/domain/news2';
import { NORMAL, parseWire, ROSTER, type Visit } from '../src/domain/visit';

const visit: Visit = {
  id: 'v-1',
  patient: ROSTER[0],
  vitals: NORMAL,
  at: 0,
  chwName: 'Ada',
};

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
  it('round-trips a visit and an ack', () => {
    expect(parseWire(JSON.stringify({ t: 'visit', visit }))).toEqual({
      t: 'visit',
      visit,
    });
    expect(parseWire('{"t":"ack","id":"v-1"}')).toEqual({
      t: 'ack',
      id: 'v-1',
    });
  });

  it('drops malformed or out-of-range content and extra fields', () => {
    const bad = (patch: object) =>
      parseWire(
        JSON.stringify({
          t: 'visit',
          visit: { ...visit, vitals: { ...NORMAL, ...patch } },
        }),
      );
    expect(parseWire('not json')).toBeNull();
    expect(parseWire('{"t":"ack"}')).toBeNull();
    expect(bad({ spo2: 140 })).toBeNull();
    expect(bad({ pulse: '80' })).toBeNull();
    expect(bad({ consciousness: 'X' })).toBeNull();
    const extra = parseWire(
      JSON.stringify({ t: 'visit', visit: { ...visit, evil: 1 } }),
    );
    expect(extra && 'evil' in (extra as any).visit).toBe(false);
  });
});

describe('visitBundle', () => {
  const bundle = visitBundle(visit) as any;

  it('makes every create conditional on a stable identifier', () => {
    for (const e of bundle.entry) {
      const [id] = e.resource.identifier;
      expect(e.request.ifNoneExist).toBe(`identifier=${id.system}|${id.value}`);
    }
    expect(bundle.entry[1].resource.identifier[0]).toEqual({
      system: SYSTEM.visit,
      value: 'v-1',
    });
  });

  it('points observations at the bundle patient and encounter', () => {
    const [patient, encounter, ...obs] = bundle.entry;
    expect(obs).toHaveLength(8);
    for (const o of obs) {
      expect(o.resource.subject.reference).toBe(patient.fullUrl);
      expect(o.resource.encounter.reference).toBe(encounter.fullUrl);
    }
    expect(new Set(bundle.entry.map((e: any) => e.fullUrl)).size).toBe(
      bundle.entry.length,
    );
  });

  it('reads the encounter status as added or duplicate', () => {
    const response = (status: string) => ({
      entry: [{}, { response: { status } }],
    });
    expect(visitOutcome(response('201 Created'))).toBe('added');
    expect(visitOutcome(response('200 OK'))).toBe('duplicate');
    expect(visitOutcome({})).toBeNull();
  });
});
