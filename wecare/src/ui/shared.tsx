import {
  ArrowRight,
  CloudUpload,
  CircleCheck,
  Lock,
  TriangleAlert,
  Waypoints,
} from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { MEDPLUM } from '../config';
import { sync } from '../mesh';
import { useStore, type Synced } from '../state';
import { Button, C, Card, F, Icon, IconTile, Pill, short, st } from './kit';

export function SyncedPill({ synced }: { synced: Synced }) {
  return synced === 'pending' ? (
    <Pill text="Not in EHR yet" icon={CloudUpload} />
  ) : (
    <Pill
      text={synced === 'added' ? 'In EHR' : 'In EHR, already there'}
      icon={CircleCheck}
      tone="success"
    />
  );
}

/** Names for addresses this phone knows; anything else stays an address. */
function useNames() {
  const s = useStore();
  const names = new Map<string, string>();
  if (s.address) names.set(s.address, 'This phone');
  if (s.clinic) names.set(s.clinic.address, s.clinic.name);
  s.workers.forEach(w => names.set(w.address, w.name));
  return (a: string) => names.get(a) ?? short(a);
}

export function CarriedCard() {
  const s = useStore();
  const name = useNames();
  const n = s.carried.length;
  return (
    <Card>
      <View style={[st.row, { gap: 12 }]}>
        <IconTile icon={Waypoints} />
        <View style={{ flex: 1 }}>
          <Text style={st.body}>
            <Text style={[st.num, { fontFamily: F.strong }]}>{n}</Text> sealed{' '}
            {n === 1 ? 'record' : 'records'} passed along for others
          </Text>
          <View style={[st.row, { gap: 5, marginTop: 2 }]}>
            <Icon icon={Lock} color={C.muted} size={14} />
            <Text style={st.small}>
              Encrypted for their recipient. Unreadable here.
            </Text>
          </View>
        </View>
      </View>
      {s.carried.slice(0, 4).map(c => (
        <View key={c.id} style={[st.row, { gap: 6 }]}>
          <Text style={st.mono} numberOfLines={1}>
            {name(c.from)}
          </Text>
          <Icon icon={ArrowRight} color={C.faint} size={14} />
          <Text style={[st.mono, { flex: 1 }]} numberOfLines={1}>
            {name(c.to)}
          </Text>
          <Text style={st.mono}>
            {new Date(c.at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      ))}
    </Card>
  );
}

export function SyncCard({ pending }: { pending: number }) {
  const s = useStore();
  const failed = !!s.syncNote && !s.syncNote.startsWith('Medplum:');
  return (
    <Card>
      <View style={[st.row, { gap: 12 }]}>
        <IconTile icon={CloudUpload} />
        <View style={{ flex: 1 }}>
          <Text style={st.body}>
            {MEDPLUM
              ? pending
                ? `${pending} ${
                    pending === 1 ? 'visit' : 'visits'
                  } waiting for the EHR`
                : 'Everything is in the EHR'
              : 'No EHR connected in this build'}
          </Text>
          <Text style={st.small}>
            {MEDPLUM
              ? 'Sends on its own once this phone is online. Copies the EHR already has are refused there.'
              : 'Visits stay on the mesh. The README explains how to connect Medplum.'}
          </Text>
        </View>
      </View>
      {!!s.syncNote && (
        <View style={[st.row, { gap: 6 }]}>
          <Icon
            icon={failed ? TriangleAlert : CircleCheck}
            color={failed ? C.error : C.success}
            size={16}
          />
          <Text
            style={[st.small, { flex: 1, color: failed ? C.error : C.success }]}
          >
            {s.syncNote}
          </Text>
        </View>
      )}
      <Button
        title="Send to EHR now"
        icon={CloudUpload}
        kind="soft"
        onPress={sync}
      />
    </Card>
  );
}
