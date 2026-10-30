import {
  Activity,
  Brain,
  Droplets,
  Gauge,
  HeartPulse,
  Thermometer,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { news2 } from '../domain/news2';
import type { Visit } from '../domain/visit';
import { C, Card, F, Icon, RiskPill, st } from './kit';

const age = (birthYear: number, at: number) =>
  new Date(at).getFullYear() - birthYear;

const ACVPU = {
  A: 'Alert',
  C: 'Confused',
  V: 'Voice',
  P: 'Pain',
  U: 'Unresponsive',
};

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
  const cells: [LucideIcon, string, string][] = [
    [Activity, 'Breathing', `${v.respRate}/min`],
    [Droplets, 'SpO₂', `${v.spo2}%${v.onOxygen ? ' on O₂' : ''}`],
    [Gauge, 'Systolic', `${v.systolic} mmHg`],
    [HeartPulse, 'Pulse', `${v.pulse}/min`],
    [Thermometer, 'Temp', `${v.tempC.toFixed(1)} °C`],
    [Brain, 'Alertness', ACVPU[v.consciousness]],
  ];
  return (
    <Card>
      <View style={[st.row, { gap: 10, alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{visit.patient.name}</Text>
          <Text style={st.small}>
            {visit.patient.sex === 'female' ? 'Female' : 'Male'},{' '}
            {age(visit.patient.birthYear, visit.at)} · {visit.patient.household}
          </Text>
        </View>
        <RiskPill risk={score.risk} total={score.total} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          rowGap: 10,
          backgroundColor: C.sunken,
          borderRadius: 6,
          padding: 12,
        }}
      >
        {cells.map(([icon, k, val]) => (
          <View key={k} style={{ width: '50%', flexDirection: 'row', gap: 8 }}>
            <Icon icon={icon} color={C.accent} size={16} />
            <View>
              <Text style={[st.label, { fontSize: 12 }]}>{k}</Text>
              <Text style={[st.body, st.num, { fontFamily: F.medium }]}>
                {val}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {footer}
    </Card>
  );
}
