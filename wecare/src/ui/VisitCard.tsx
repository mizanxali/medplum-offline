import React from 'react';
import { Text, View } from 'react-native';
import { news2 } from '../domain/news2';
import type { Visit } from '../domain/visit';
import { Card, RiskChip, st } from './kit';

const age = (birthYear: number, at: number) =>
  new Date(at).getFullYear() - birthYear;

/** One visit as a chart row. The score is recomputed here, never taken from the sender. */
export function VisitCard({
  visit,
  footer,
}: {
  visit: Visit;
  footer: React.ReactNode;
}) {
  const v = visit.vitals;
  const score = news2(v);
  const cells: [string, string][] = [
    ['RR', `${v.respRate}`],
    ['SpO₂', `${v.spo2}%${v.onOxygen ? ' O₂' : ''}`],
    ['BP sys', `${v.systolic}`],
    ['HR', `${v.pulse}`],
    ['Temp', `${v.tempC.toFixed(1)}°`],
    ['ACVPU', v.consciousness],
  ];
  return (
    <Card>
      <View style={[st.row, { justifyContent: 'space-between' }]}>
        <Text style={st.title}>{visit.patient.name}</Text>
        <RiskChip risk={score.risk} total={score.total} />
      </View>
      <Text style={st.small}>
        {visit.patient.sex === 'female' ? 'F' : 'M'} ·{' '}
        {age(visit.patient.birthYear, visit.at)} y · {visit.patient.household}
      </Text>
      <View style={[st.row, { flexWrap: 'wrap', gap: 6 }]}>
        {cells.map(([k, val]) => (
          <View key={k} style={{ minWidth: '30%', flexGrow: 1 }}>
            <Text style={[st.small, { fontSize: 11 }]}>{k}</Text>
            <Text style={[st.body, st.num, { fontWeight: '600' }]}>{val}</Text>
          </View>
        ))}
      </View>
      <View style={st.divider} />
      {footer}
    </Card>
  );
}
