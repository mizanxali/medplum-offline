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
import { bornOf, householdOf, nameOf } from '../domain/panel';
import type { Visit } from '../domain/visit';
import type { ChartPatient } from '../state';
import { C, Card, F, Icon, RiskPill, st } from './kit';

/** "Female, 66 · Hillside 4" from a Patient, with this phone's unsynced household if any. */
export function about(p: ChartPatient, at = Date.now()) {
  const sex =
    { female: 'Female', male: 'Male' }[p.resource.gender as string] ??
    'Sex unknown';
  const born = bornOf(p.resource);
  const age = Number.isFinite(born)
    ? `, ${new Date(at).getFullYear() - born}`
    : '';
  return `${sex}${age} · ${p.household || householdOf(p.resource)}`;
}

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
  patient,
  footer,
}: {
  visit: Visit;
  patient?: ChartPatient;
  footer?: React.ReactNode;
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
          <Text style={st.title}>
            {patient ? nameOf(patient.resource) : 'Patient not on this phone'}
          </Text>
          <Text style={st.small}>
            {patient ? `${about(patient, visit.at)} · ` : ''}
            {new Date(visit.at).toLocaleString([], {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {visit.by ? `, ${visit.by}` : ''}
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
      {!!visit.note && (
        <Text style={[st.body, { color: C.muted }]}>{visit.note}</Text>
      )}
      {footer}
    </Card>
  );
}
