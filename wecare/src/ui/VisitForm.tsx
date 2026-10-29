import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACTION,
  news2,
  type Consciousness,
  type Vitals,
} from '../domain/news2';
import { newId, NORMAL, RANGES, ROSTER, type Patient } from '../domain/visit';
import { record } from '../mesh';
import { useStore } from '../state';
import { Button, C, Card, Label, RISK, st } from './kit';

type Numeric = keyof typeof RANGES;

const ROWS: { key: Numeric; label: string; unit: string; step: number }[] = [
  { key: 'respRate', label: 'Respiration', unit: '/min', step: 1 },
  { key: 'spo2', label: 'SpO₂', unit: '%', step: 1 },
  { key: 'systolic', label: 'Systolic BP', unit: 'mmHg', step: 5 },
  { key: 'pulse', label: 'Pulse', unit: '/min', step: 2 },
  { key: 'tempC', label: 'Temperature', unit: '°C', step: 0.1 },
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
  { k: 'V', label: 'Voice' },
  { k: 'P', label: 'Pain' },
  { k: 'U', label: 'Unresponsive' },
];

const clamp = (k: Numeric, v: number) =>
  Math.round(Math.min(RANGES[k][1], Math.max(RANGES[k][0], v)) * 10) / 10;

export function VisitForm({ onDone }: { onDone: () => void }) {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [v, setV] = useState<Vitals>(NORMAL);
  const score = news2(v);
  const risk = RISK[score.risk];

  return (
    <View style={st.screen}>
      <View style={[st.band, { paddingTop: insets.top + 10 }]}>
        <View style={st.row}>
          <Pressable onPress={onDone} hitSlop={12}>
            <Text style={st.bandMenu}>Cancel</Text>
          </Pressable>
          <Text style={[st.bandTitle, { textAlign: 'center' }]}>New visit</Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* The score is the point of the form, so it stays in view. */}
      <View
        style={{
          backgroundColor: risk.bg,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={st.row}>
          <Text
            style={[
              st.num,
              {
                fontSize: 40,
                fontWeight: '800',
                color: risk.fg,
                marginRight: 12,
              },
            ]}
          >
            {score.total}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[st.label, { color: risk.fg }]}>
              NEWS2 · {risk.label} risk
            </Text>
            <Text style={[st.title, { color: risk.fg }]}>
              {ACTION[score.risk]}
            </Text>
          </View>
        </View>
        <Text style={[st.small, { color: risk.fg, marginTop: 2 }]}>
          Scored on this phone. Validated for adults only.
        </Text>
      </View>

      <ScrollView contentContainerStyle={st.scroll}>
        <Label>Patient</Label>
        <View style={[st.row, { flexWrap: 'wrap', gap: 8 }]}>
          {ROSTER.map(p => {
            const on = patient?.id === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPatient(p)}
                style={[
                  st.card,
                  { paddingVertical: 8, gap: 0 },
                  on && { borderColor: C.accent, borderWidth: 2 },
                ]}
              >
                <Text style={[st.body, { fontWeight: '600' }]}>{p.name}</Text>
                <Text style={[st.small, { fontSize: 12 }]}>{p.household}</Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[st.row, { justifyContent: 'space-between', marginTop: 6 }]}
        >
          <Label>Vitals</Label>
          <View style={[st.row, { gap: 12 }]}>
            {PRESETS.map(p => (
              <Text
                key={p.name}
                style={[st.small, { color: C.accent, fontWeight: '700' }]}
                onPress={() => setV(p.vitals)}
              >
                {p.name}
              </Text>
            ))}
          </View>
        </View>
        <Card style={{ paddingVertical: 4, gap: 0 }}>
          {ROWS.map((r, i) => {
            const part = score.parts[r.key];
            return (
              <View key={r.key}>
                {i > 0 && <View style={st.divider} />}
                <View style={[st.row, { paddingVertical: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.body}>{r.label}</Text>
                    <Text
                      style={[
                        st.small,
                        { fontSize: 12, color: part ? '#C2510F' : C.muted },
                      ]}
                    >
                      {part ? `+${part} to score` : 'in range'}
                    </Text>
                  </View>
                  <Step
                    label="−"
                    onPress={() =>
                      setV(x => ({
                        ...x,
                        [r.key]: clamp(r.key, x[r.key] - r.step),
                      }))
                    }
                  />
                  <Text
                    style={[
                      st.num,
                      {
                        width: 92,
                        textAlign: 'center',
                        fontSize: 22,
                        fontWeight: '700',
                        color: C.ink,
                      },
                    ]}
                  >
                    {r.key === 'tempC' ? v[r.key].toFixed(1) : v[r.key]}
                    <Text style={[st.small, { fontSize: 12 }]}> {r.unit}</Text>
                  </Text>
                  <Step
                    label="+"
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
          <View style={[st.row, { paddingVertical: 10 }]}>
            <Text style={[st.body, { flex: 1 }]}>On supplemental oxygen</Text>
            <Switch
              value={v.onOxygen}
              onValueChange={onOxygen => setV(x => ({ ...x, onOxygen }))}
              trackColor={{ true: C.accent, false: C.line }}
            />
          </View>
        </Card>

        <Label>Consciousness (ACVPU)</Label>
        <View style={[st.row, { flexWrap: 'wrap', gap: 8 }]}>
          {ACVPU.map(a => {
            const on = v.consciousness === a.k;
            return (
              <Pressable
                key={a.k}
                onPress={() => setV(x => ({ ...x, consciousness: a.k }))}
                style={[
                  st.chip,
                  {
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    backgroundColor: on ? C.ink : C.card,
                    borderWidth: 1,
                    borderColor: on ? C.ink : C.line,
                  },
                ]}
              >
                <Text style={[st.chipText, { color: on ? '#fff' : C.ink }]}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          title={
            patient
              ? `Save visit for ${patient.name.split(' ')[0]}`
              : 'Choose a patient'
          }
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
          Saved on this phone first. It travels to the clinic sealed, over any
          phones in between.
        </Text>
      </ScrollView>
    </View>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? C.line : C.accentSoft,
      })}
    >
      <Text style={{ fontSize: 22, fontWeight: '600', color: C.accent }}>
        {label}
      </Text>
    </Pressable>
  );
}
