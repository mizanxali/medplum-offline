import React from 'react';
import { Text, View } from 'react-native';
import { MEDPLUM } from '../config';
import { sync } from '../mesh';
import { useStore, type Synced } from '../state';
import { Button, C, Card, Chip, Label, short, st } from './kit';

export const SYNCED: Record<Synced, { text: string; fg: string; bg: string }> =
  {
    pending: { text: 'Not in EHR yet', fg: C.muted, bg: '#EFECE5' },
    added: { text: 'In EHR', fg: C.accent, bg: C.accentSoft },
    duplicate: {
      text: 'In EHR (already there)',
      fg: C.accent,
      bg: C.accentSoft,
    },
  };

export function SyncedChip({ synced }: { synced: Synced }) {
  const s = SYNCED[synced];
  return <Chip text={s.text} fg={s.fg} bg={s.bg} />;
}

/** Names for addresses this phone knows; anything else stays an address. */
function useNames() {
  const s = useStore();
  const names = new Map<string, string>();
  if (s.address) names.set(s.address, 'this phone');
  if (s.clinic) names.set(s.clinic.address, s.clinic.name);
  s.workers.forEach(w => names.set(w.address, w.name));
  return (a: string) => names.get(a) ?? short(a);
}

export function CarriedCard() {
  const s = useStore();
  const name = useNames();
  return (
    <Card>
      <Label>Carried for others</Label>
      <Text style={st.body}>
        <Text style={[st.title, st.num]}>{s.carried.length}</Text> sealed{' '}
        {s.carried.length === 1 ? 'frame' : 'frames'} forwarded. This phone
        passed them on and cannot read them: they are encrypted end to end for
        their recipient.
      </Text>
      {s.carried.slice(0, 4).map(c => (
        <Text key={c.id} style={st.mono} numberOfLines={1}>
          {name(c.from)} → {name(c.to)} ·{' '}
          {new Date(c.at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      ))}
    </Card>
  );
}

export function SyncCard({ pending }: { pending: number }) {
  const s = useStore();
  return (
    <Card>
      <Label>EHR · Medplum</Label>
      <Text style={st.small}>
        {MEDPLUM
          ? `${pending} visit${
              pending === 1 ? '' : 's'
            } waiting. Sends on its own when this phone has internet; the server refuses copies it already holds.`
          : 'No Medplum credentials in this build, so visits stay on the mesh. See the README.'}
      </Text>
      {!!s.syncNote && (
        <Text style={[st.small, { color: C.ink }]}>{s.syncNote}</Text>
      )}
      <View style={{ marginTop: 4 }}>
        <Button title="Send to EHR now" kind="plain" onPress={sync} />
      </View>
    </Card>
  );
}
