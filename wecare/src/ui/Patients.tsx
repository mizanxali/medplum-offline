import {
  ArrowLeft,
  ChevronRight,
  CloudUpload,
  House,
  Plus,
  TriangleAlert,
  Users,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { news2 } from '../domain/news2';
import { householdOf, nameOf, versionOf } from '../domain/panel';
import { drop, editHousehold, keepMine } from '../mesh';
import { chart, useStore, type ChartPatient } from '../state';
import {
  Button,
  C,
  Card,
  Header,
  HeaderAction,
  Icon,
  IconTile,
  Pill,
  RiskPill,
  Scroll,
  Section,
  st,
} from './kit';
import { about, VisitCard } from './VisitCard';

const notSaved = (e: unknown) =>
  Alert.alert('Not saved', e instanceof Error ? e.message : String(e));

/** The panel, as this phone knows it offline: last snapshot plus its own unsynced records. */
export function PatientList({ onOpen }: { onOpen: (id: string) => void }) {
  const s = useStore();
  const patients = chart(s);
  return (
    <>
      <Section title="Patients" count={patients.length} />
      {patients.length === 0 && (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconTile icon={Users} color={C.muted} bg={C.sunken} />
          <Text style={[st.small, { flex: 1 }]}>
            {s.role === 'clinic'
              ? 'Patients arrive from Medplum once this phone is signed in and online.'
              : 'Your patients arrive with the clinic, over the mesh, or from Medplum when this phone is online.'}
          </Text>
        </Card>
      )}
      {patients.map(p => {
        const last = p.visits[0];
        const score = last && news2(last.vitals);
        const pending = p.visits.some(v => v.pending) || !!p.edit;
        return (
          <Pressable
            key={p.resource.id}
            onPress={() => onOpen(p.resource.id)}
            accessibilityRole="button"
          >
            <Card
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.title}>{nameOf(p.resource)}</Text>
                <Text style={st.small}>{about(p)}</Text>
                {pending && (
                  <View style={[st.row, { gap: 5 }]}>
                    <Icon icon={CloudUpload} color={C.muted} size={14} />
                    <Text style={[st.small, { fontSize: 12.5 }]}>
                      {p.edit?.synced === 'conflict'
                        ? 'Changed in the EHR meanwhile'
                        : 'Not in the EHR yet'}
                    </Text>
                  </View>
                )}
              </View>
              {score && <RiskPill risk={score.risk} total={score.total} />}
              <Icon icon={ChevronRight} color={C.faint} size={18} />
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={st.label}>{title}</Text>
      <Text style={[st.body, !items.length && { color: C.faint }]}>
        {items.length ? items.join('\n') : 'None recorded'}
      </Text>
    </View>
  );
}

export function PatientScreen({
  id,
  onBack,
  onRecord,
}: {
  id: string;
  onBack: () => void;
  onRecord?: () => void; // health worker only; the clinic reads
}) {
  const s = useStore();
  const p = chart(s).find(x => x.resource.id === id);
  if (!p) {
    return (
      <View style={st.screen}>
        <Header
          title="Patient"
          showStatus={false}
          right={
            <HeaderAction icon={ArrowLeft} label="Back" onPress={onBack} />
          }
        />
      </View>
    );
  }
  return (
    <View style={st.screen}>
      <Header
        title={nameOf(p.resource)}
        showStatus={false}
        right={<HeaderAction icon={ArrowLeft} label="Back" onPress={onBack} />}
      />
      <Scroll keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={st.small}>{about(p)}</Text>
          <Household p={p} editable={!!onRecord} />
        </Card>

        <Section title="Chart" />
        <Card>
          <List title="Problems" items={p.problems} />
          <View style={st.divider} />
          <List title="Allergies" items={p.allergies} />
          <View style={st.divider} />
          <List title="Medicines" items={p.meds} />
        </Card>

        {onRecord && (
          <Button title="Record a visit" icon={Plus} onPress={onRecord} />
        )}

        <Section title="Recent visits" count={p.visits.length} />
        {p.visits.length === 0 && (
          <Text style={st.small}>No visits on record yet.</Text>
        )}
        {p.visits.map(v => (
          <VisitCard
            key={v.id}
            visit={v}
            patient={p}
            footer={
              v.pending ? (
                <Pill text="Not in EHR yet" icon={CloudUpload} />
              ) : null
            }
          />
        ))}
      </Scroll>
    </View>
  );
}

/** The one edit: where the patient lives. One change at a time, never over a newer one. */
function Household({ p, editable }: { p: ChartPatient; editable: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const edit = p.edit;

  if (edit?.synced === 'conflict' && edit.edit) {
    const fresh = versionOf(p.resource) !== edit.edit.base;
    return (
      <View
        style={{
          gap: 8,
          backgroundColor: C.errorSoft,
          borderRadius: 6,
          padding: 12,
        }}
      >
        <View style={[st.row, { gap: 6 }]}>
          <Icon icon={TriangleAlert} color={C.error} size={16} />
          <Text style={[st.body, { flex: 1, color: C.error }]}>
            Someone changed this patient in the EHR first. Nothing was
            overwritten.
          </Text>
        </View>
        <Text style={st.small}>
          EHR: {householdOf(p.resource) || 'no household'}
        </Text>
        <Text style={st.small}>This phone: {edit.edit.household}</Text>
        {editable ? (
          <View style={[st.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Button
                title={fresh ? 'Keep mine' : 'Waiting for the EHR'}
                kind="soft"
                disabled={!fresh}
                onPress={() => keepMine(p).catch(notSaved)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Use the EHR's"
                kind="soft"
                onPress={() => drop(edit.id)}
              />
            </View>
          </View>
        ) : (
          <Button title="Dismiss" kind="soft" onPress={() => drop(edit.id)} />
        )}
      </View>
    );
  }

  if (draft !== null) {
    return (
      <View style={{ gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          maxLength={80}
          autoFocus
          accessibilityLabel="Household"
          style={st.input}
        />
        <View style={[st.row, { gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Button
              title="Save"
              disabled={!draft.trim() || draft.trim() === p.household}
              onPress={() => {
                editHousehold(p, draft.trim()).then(
                  () => setDraft(null),
                  notSaved,
                );
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" kind="soft" onPress={() => setDraft(null)} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[st.row, { gap: 10 }]}>
      <Icon icon={House} color={C.accent} size={18} />
      <Text style={[st.body, { flex: 1 }]}>
        {p.household || 'No household'}
      </Text>
      {editable &&
        (edit ? (
          // ponytail: one unsynced edit per patient; a second would carry the same old version
          <Text style={st.small}>Waiting for the EHR</Text>
        ) : (
          <Pressable onPress={() => setDraft(p.household)} hitSlop={10}>
            <Text style={[st.small, { color: C.accent }]}>Edit</Text>
          </Pressable>
        ))}
    </View>
  );
}
