import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { news2, type Risk } from '../domain/news2';
import { accept, decline, inviteCode, resetDemo } from '../mesh';
import { useStore } from '../state';
import { Button, Card, Label, short, StatusBand, st } from './kit';
import { CarriedCard, SyncCard, SyncedChip } from './shared';
import { VisitCard } from './VisitCard';

const SEVERITY: Record<Risk, number> = {
  high: 3,
  medium: 2,
  'low-medium': 1,
  low: 0,
};

export function Clinic() {
  const s = useStore();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(s.workers.length === 0);

  useEffect(() => {
    if (s.status === 'on' && !code) inviteCode().then(setCode, () => {});
  }, [s.status, code]);

  // Sickest first, then newest.
  const visits = [...s.received].sort(
    (a, b) =>
      SEVERITY[news2(b.visit.vitals).risk] -
        SEVERITY[news2(a.visit.vitals).risk] || b.receivedAt - a.receivedAt,
  );
  const workerName = (a: string) =>
    s.workers.find(w => w.address === a)?.name ?? short(a);

  return (
    <View style={st.screen}>
      <StatusBand
        title={s.name}
        onMenu={() =>
          Alert.alert(
            'Reset this phone?',
            'Clears enrolled workers and received visits.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: resetDemo },
            ],
          )
        }
      />
      <ScrollView contentContainerStyle={st.scroll}>
        {s.requests.map(r => (
          <Card
            key={r.address}
            style={{ borderColor: '#C2510F', borderWidth: 2, padding: 13 }}
          >
            <Label>Enrollment request</Label>
            <Text style={st.title}>{r.name}</Text>
            <Text style={st.mono}>{short(r.address)}</Text>
            <View style={[st.row, { gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Button title="Enroll" onPress={() => accept(r.address)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Decline"
                  kind="plain"
                  onPress={() => decline(r.address)}
                />
              </View>
            </View>
          </Card>
        ))}

        <Card>
          <View style={[st.row, { justifyContent: 'space-between' }]}>
            <Label>Health workers · {s.workers.length}</Label>
            <Text
              style={[st.small, { fontWeight: '700' }]}
              onPress={() => setShowCode(x => !x)}
            >
              {showCode ? 'Hide code' : 'Enroll someone'}
            </Text>
          </View>
          {s.workers.length > 0 && (
            <Text style={st.body}>{s.workers.map(w => w.name).join(', ')}</Text>
          )}
          {showCode && (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              {code ? (
                <QRCode value={code} size={210} />
              ) : (
                <Text style={st.small}>Waiting for the mesh…</Text>
              )}
              <Text style={[st.small, { textAlign: 'center' }]}>
                Scan with CareRounds on the health worker's phone, within
                Bluetooth range. The code carries this clinic's key, not a
                password.
              </Text>
            </View>
          )}
        </Card>

        <Label style={{ marginTop: 4 }}>
          Visits received · {visits.length}
        </Label>
        {visits.length === 0 && (
          <Text style={st.small}>
            Nothing yet. Visits arrive here directly or through other health
            workers' phones.
          </Text>
        )}
        {visits.map(r => (
          <VisitCard
            key={r.visit.id}
            visit={r.visit}
            footer={
              <View style={[st.row, { justifyContent: 'space-between' }]}>
                <Text style={st.small}>
                  {workerName(r.from)} ·{' '}
                  {r.hops === 0
                    ? 'direct'
                    : `via ${r.hops} other phone${
                        r.hops === 1 ? '' : 's'
                      }`}{' '}
                  ·{' '}
                  {new Date(r.receivedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <SyncedChip synced={r.synced} />
              </View>
            }
          />
        ))}

        <SyncCard
          pending={s.received.filter(r => r.synced === 'pending').length}
        />
        <CarriedCard />
      </ScrollView>
    </View>
  );
}
