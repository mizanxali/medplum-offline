import {
  Check,
  Inbox,
  QrCode,
  RotateCcw,
  UserRound,
  Waypoints,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { news2, type Risk } from '../domain/news2';
import { accept, decline, inviteCode, resetDemo } from '../mesh';
import { chart, useStore } from '../state';
import {
  Button,
  C,
  Card,
  F,
  Header,
  HeaderAction,
  Icon,
  IconTile,
  Scroll,
  Section,
  short,
  st,
} from './kit';
import { PatientList, PatientScreen } from './Patients';
import { CarriedCard, SyncCard, SyncedPill } from './shared';
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
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (s.status === 'on' && !code) inviteCode().then(setCode, () => {});
  }, [s.status, code]);

  if (open) return <PatientScreen id={open} onBack={() => setOpen(null)} />;

  // Sickest first, then newest. Scored here from the signed vitals, never taken from the sender.
  const patients = chart(s);
  const visits = s.received
    .filter(r => r.visit)
    .sort(
      (a, b) =>
        SEVERITY[news2(b.visit!.vitals).risk] -
          SEVERITY[news2(a.visit!.vitals).risk] || b.receivedAt - a.receivedAt,
    );
  const workerName = (a: string) =>
    s.workers.find(w => w.address === a)?.name ?? short(a);

  return (
    <View style={st.screen}>
      <Header
        title={s.name}
        right={
          <HeaderAction
            icon={RotateCcw}
            label="Reset"
            onPress={() =>
              Alert.alert(
                'Reset this phone?',
                'Clears enrolled workers, the sign-in and received records.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: resetDemo },
                ],
              )
            }
          />
        }
      />
      <Scroll>
        {s.requests.map(r => (
          <Card
            key={r.address}
            style={{ borderColor: C.accent, borderWidth: 1.5 }}
          >
            <View style={[st.row, { gap: 12 }]}>
              <IconTile icon={UserRound} />
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{r.name} would like to enroll</Text>
                <Text style={st.mono}>{short(r.address)}</Text>
              </View>
            </View>
            <View style={[st.row, { gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Enroll"
                  icon={Check}
                  onPress={() => accept(r.address)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Decline"
                  icon={X}
                  kind="soft"
                  onPress={() => decline(r.address)}
                />
              </View>
            </View>
          </Card>
        ))}

        <Section
          title="Health workers"
          count={s.workers.length}
          right={
            <Pressable
              onPress={() => setShowCode(x => !x)}
              hitSlop={10}
              style={[st.row, { gap: 6 }]}
            >
              <Icon icon={QrCode} color={C.accent} size={16} />
              <Text
                style={[st.small, { color: C.accent, fontFamily: F.medium }]}
              >
                {showCode ? 'Hide code' : 'Enroll someone'}
              </Text>
            </Pressable>
          }
        />
        {(s.workers.length > 0 || showCode) && (
          <Card>
            {s.workers.map(w => (
              <View key={w.address} style={[st.row, { gap: 10 }]}>
                <Icon icon={UserRound} color={C.accent} size={18} />
                <Text style={[st.body, { flex: 1 }]}>{w.name}</Text>
                <Text style={st.mono}>{short(w.address)}</Text>
              </View>
            ))}
            {s.workers.length > 0 && showCode && <View style={st.divider} />}
            {showCode && (
              <View
                style={{ alignItems: 'center', gap: 12, paddingVertical: 6 }}
              >
                {code ? (
                  <View
                    style={{
                      padding: 14,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 8,
                    }}
                  >
                    <QRCode value={code} size={196} color={C.ink} />
                  </View>
                ) : (
                  <Text style={st.small}>Waiting for the mesh…</Text>
                )}
                <Text style={[st.small, { textAlign: 'center' }]}>
                  Scan this with WeCare on the health worker's phone, close by.
                  It carries this clinic's key, not a password.
                </Text>
              </View>
            )}
          </Card>
        )}

        <Section title="Visits received" count={visits.length} />
        {visits.length === 0 && (
          <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconTile icon={Inbox} color={C.muted} bg={C.sunken} />
            <Text style={[st.small, { flex: 1 }]}>
              Nothing yet. Visits arrive here directly or through other health
              workers' phones, sickest first.
            </Text>
          </Card>
        )}
        {visits.map(r => (
          <VisitCard
            key={r.id}
            visit={r.visit!}
            patient={patients.find(p => p.resource.id === r.visit!.patientId)}
            footer={
              <View
                style={[
                  st.row,
                  { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
                ]}
              >
                <View style={[st.row, { gap: 6 }]}>
                  <Icon
                    icon={r.hops === 0 ? UserRound : Waypoints}
                    color={C.muted}
                    size={14}
                  />
                  <Text style={st.small}>
                    {workerName(r.from)},{' '}
                    {r.hops === 0
                      ? 'direct'
                      : `via ${r.hops} other phone${r.hops === 1 ? '' : 's'}`}
                    ,{' '}
                    {new Date(r.receivedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <SyncedPill synced={r.synced} />
              </View>
            }
          />
        ))}

        <PatientList onOpen={setOpen} />

        <Section title="Electronic health record" />
        <SyncCard
          pending={s.received.filter(r => r.synced === 'pending').length}
        />
        <Section title="Carried for others" />
        <CarriedCard />
      </Scroll>
    </View>
  );
}
