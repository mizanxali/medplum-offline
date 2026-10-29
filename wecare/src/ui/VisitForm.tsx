import {
  Activity,
  Check,
  Droplets,
  Gauge,
  HeartPulse,
  Minus,
  Plus,
  Thermometer,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import {
  ACTION,
  news2,
  type Consciousness,
  type Vitals,
} from '../domain/news2';
import { newId, NORMAL, RANGES, ROSTER, type Patient } from '../domain/visit';
import { record } from '../mesh';
import { useStore } from '../state';
import {
  Button,
  C,
  Card,
  F,
  Header,
  HeaderAction,
  Icon,
  RISK,
  Scroll,
  Section,
  st,
} from './kit';

type Numeric = keyof typeof RANGES;

const ROWS: {
  key: Numeric;
  icon: LucideIcon;
  label: string;
  unit: string;
  step: number;
}[] = [
  {
    key: 'respRate',
    icon: Activity,
    label: 'Breathing',
    unit: '/min',
    step: 1,
  },
  { key: 'spo2', icon: Droplets, label: 'SpO₂', unit: '%', step: 1 },
  { key: 'systolic', icon: Gauge, label: 'Systolic BP', unit: 'mmHg', step: 5 },
  { key: 'pulse', icon: HeartPulse, label: 'Pulse', unit: '/min', step: 2 },
  {
    key: 'tempC',
    icon: Thermometer,
    label: 'Temperature',
    unit: '°C',
    step: 0.1,
  },
];

// Quick fills for a demo; each lands in a different NEWS2 band.
const PRESETS: { name: string; vitals: Vitals }[] = [
  { name: 'Well', vitals: NORMAL },
  {
    name: 'Feverish',
    vitals: { ...NORMAL, respRate: 22, pulse: 112, tempC: 38.6 },
  },
  {
    name: 'Deteriorating',
    vitals: {
      respRate: 27,
      spo2: 90,
      onOxygen: false,
      systolic: 96,
      pulse: 124,
      consciousness: 'C',
      tempC: 39.4,
    },
  },
];

const ACVPU: { k: Consciousness; label: string }[] = [
  { k: 'A', label: 'Alert' },
  { k: 'C', label: 'New confusion' },
  { k: 'V', label: 'Responds to voice' },
  { k: 'P', label: 'Responds to pain' },
  { k: 'U', label: 'Unresponsive' },
];

const clamp = (k: Numeric, v: number) =>
  Math.round(Math.min(RANGES[k][1], Math.max(RANGES[k][0], v)) * 10) / 10;

export function VisitForm({ onDone }: { onDone: () => void }) {
  const s = useStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [v, setV] = useState<Vitals>(NORMAL);
  const score = news2(v);
  const risk = RISK[score.risk];

  return (
    <View style={st.screen}>
      <Header
        title="New visit"
        showStatus={false}
        right={<HeaderAction icon={X} label="Cancel" onPress={onDone} />}
      />

      {/* The score is the point of the form, so it stays in view. */}
      <View
        style={{
          marginHorizontal: 18,
          marginBottom: 8,
          borderRadius: 8,
          backgroundColor: risk.bg,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Text
          style={[
            st.num,
            { fontFamily: F.title, fontSize: 46, color: risk.fg },
          ]}
        >
          {score.total}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: risk.fg }]}>
            {ACTION[score.risk]}
          </Text>
          <Text style={[st.small, { color: risk.fg }]}>
            NEWS2, {risk.label.toLowerCase()} risk. Scored on this phone, for
            adults.
          </Text>
        </View>
      </View>

      <Scroll>
        <Section title="Patient" />
        <View style={[st.row, { flexWrap: 'wrap', gap: 8 }]}>
          {ROSTER.map(p => {
            const on = patient?.id === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPatient(p)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[
                  st.card,
                  { paddingVertical: 10, paddingHorizontal: 12, gap: 0 },
                  on && {
                    borderColor: C.accent,
                    borderWidth: 1.5,
                    backgroundColor: C.accentSoft,
                  },
                ]}
              >
                <View style={[st.row, { gap: 6 }]}>
                  <Text style={[st.body, { fontFamily: F.medium }]}>
                    {p.name}
                  </Text>
                  {on && <Icon icon={Check} color={C.accent} size={16} />}
                </View>
                <Text style={[st.small, { fontSize: 12.5 }]}>
                  {p.household}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Section
          title="Vitals"
          right={
            <View style={[st.row, { gap: 6 }]}>
              {PRESETS.map(p => (
                <Pressable
                  key={p.name}
                  onPress={() => setV(p.vitals)}
                  hitSlop={6}
                  style={{
                    backgroundColor: C.surface,
                    borderRadius: 6,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={[st.label, { color: C.accent }]}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
        <Card style={{ paddingVertical: 6, gap: 0 }}>
          {ROWS.map((r, i) => {
            const part = score.parts[r.key];
            return (
              <View key={r.key}>
                {i > 0 && <View style={st.divider} />}
                <View style={[st.row, { paddingVertical: 10, gap: 12 }]}>
                  <Icon icon={r.icon} color={C.accent} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.body}>{r.label}</Text>
                    <Text
                      style={[
                        st.small,
                        { fontSize: 12.5, color: part ? C.orange : C.faint },
                      ]}
                    >
                      {part ? `+${part} to score` : 'In range'}
                    </Text>
                  </View>
                  <Step
                    icon={Minus}
                    label={`Lower ${r.label}`}
                    onPress={() =>
                      setV(x => ({
                        ...x,
                        [r.key]: clamp(r.key, x[r.key] - r.step),
                      }))
                    }
                  />
                  <View style={{ width: 70, alignItems: 'center' }}>
                    <Text
                      style={[
                        st.num,
                        { fontFamily: F.strong, fontSize: 21, color: C.ink },
                      ]}
                    >
                      {r.key === 'tempC' ? v[r.key].toFixed(1) : v[r.key]}
                    </Text>
                    <Text style={[st.small, { fontSize: 11.5 }]}>{r.unit}</Text>
                  </View>
                  <Step
                    icon={Plus}
                    label={`Raise ${r.label}`}
                    onPress={() =>
                      setV(x => ({
                        ...x,
                        [r.key]: clamp(r.key, x[r.key] + r.step),
                      }))
                    }
                  />
                </View>
              </View>
            );
          })}
          <View style={st.divider} />
          <View style={[st.row, { paddingVertical: 10, gap: 12 }]}>
            <Icon icon={Wind} color={C.accent} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={st.body}>On supplemental oxygen</Text>
              <Text
                style={[
                  st.small,
                  { fontSize: 12.5, color: v.onOxygen ? C.orange : C.faint },
                ]}
              >
                {v.onOxygen ? '+2 to score' : 'Room air'}
              </Text>
            </View>
            <Switch
              value={v.onOxygen}
              onValueChange={onOxygen => setV(x => ({ ...x, onOxygen }))}
              trackColor={{ true: C.accent, false: C.line }}
              thumbColor={C.surface}
              ios_backgroundColor={C.line}
            />
          </View>
        </Card>

        <Section title="Alertness" />
        <View style={[st.row, { flexWrap: 'wrap', gap: 8 }]}>
          {ACVPU.map(a => {
            const on = v.consciousness === a.k;
            return (
              <Pressable
                key={a.k}
                onPress={() => setV(x => ({ ...x, consciousness: a.k }))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[
                  st.pill,
                  {
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    backgroundColor: on ? C.accent : C.surface,
                    borderWidth: 1,
                    borderColor: on ? C.accent : C.line,
                  },
                ]}
              >
                <Text
                  style={[
                    st.pillText,
                    { fontSize: 14, color: on ? '#FFFFFF' : C.ink },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 6 }} />
        <Button
          title={
            patient
              ? `Save visit for ${patient.name.split(' ')[0]}`
              : 'Choose a patient to save'
          }
          icon={Check}
          disabled={!patient}
          onPress={() => {
            if (!patient) return;
            record({
              id: newId(),
              patient,
              vitals: v,
              at: Date.now(),
              chwName: s.name,
            });
            onDone();
          }}
        />
        <Text style={[st.small, { textAlign: 'center' }]}>
          Saved on this phone first, then carried to the clinic sealed, through
          any phones in between.
        </Text>
      </Scroll>
    </View>
  );
}

function Step({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? C.line : C.sunken,
      })}
    >
      <Icon icon={icon} color={C.accent} size={18} />
    </Pressable>
  );
}
