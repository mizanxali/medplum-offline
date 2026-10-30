import {
  Building2,
  CircleCheck,
  Clock,
  ClipboardList,
  Plus,
  RotateCcw,
  ScanLine,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enroll, resetDemo } from '../mesh';
import { chart, useStore, type Sent } from '../state';
import {
  Button,
  C,
  Card,
  F,
  Header,
  HeaderAction,
  Icon,
  IconTile,
  Pill,
  Scroll,
  Section,
  st,
} from './kit';
import { PatientList, PatientScreen } from './Patients';
import { CarriedCard, SyncCard, SyncedPill } from './shared';
import { VisitCard } from './VisitCard';
import { VisitForm } from './VisitForm';

type Screen =
  | { name: 'home' | 'scan' }
  | { name: 'visit'; patientId?: string; back?: string }
  | { name: 'patient'; id: string };

export function Worker() {
  const s = useStore();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });

  if (screen.name === 'scan') return <Scanner onDone={home} />;
  if (screen.name === 'visit') {
    const { back } = screen;
    return (
      <VisitForm
        patientId={screen.patientId}
        onDone={() =>
          setScreen(back ? { name: 'patient', id: back } : { name: 'home' })
        }
      />
    );
  }
  if (screen.name === 'patient') {
    const id = screen.id;
    return (
      <PatientScreen
        id={id}
        onBack={home}
        onRecord={() => setScreen({ name: 'visit', patientId: id, back: id })}
      />
    );
  }
  const patients = chart(s);
  const visits = s.sent.filter(x => x.visit);

  const openScanner = async () => {
    if (Platform.OS === 'android') {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (r !== 'granted') return;
    }
    setScreen({ name: 'scan' });
  };

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
                'Clears the clinic enrollment, the sign-in and every record on this phone.',
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
        <Card>
          <View style={[st.row, { gap: 12 }]}>
            <IconTile icon={Building2} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.title}>
                {s.clinic ? s.clinic.name : 'No clinic yet'}
              </Text>
              {s.clinic && s.enrolled ? (
                <View style={[st.row, { gap: 5 }]}>
                  <Icon icon={CircleCheck} color={C.success} size={14} />
                  <Text style={[st.small, { color: C.success }]}>
                    Enrolled. Visits are sealed for this clinic alone.
                  </Text>
                </View>
              ) : (
                <Text style={st.small}>
                  {s.clinic
                    ? 'Waiting for the clinic to accept. Stay close to the clinic phone.'
                    : "Scan the clinic's code while you are close to its phone."}
                </Text>
              )}
            </View>
          </View>
          {!s.enrolled && (
            <Button
              title={s.clinic ? 'Scan a different code' : 'Scan clinic code'}
              icon={ScanLine}
              kind={s.clinic ? 'soft' : 'primary'}
              onPress={openScanner}
            />
          )}
        </Card>

        <Button
          title="New visit"
          icon={Plus}
          onPress={() => setScreen({ name: 'visit' })}
        />

        <PatientList onOpen={id => setScreen({ name: 'patient', id })} />

        <Section title="Visits from this phone" count={visits.length} />
        {visits.length === 0 && (
          <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconTile icon={ClipboardList} color={C.muted} bg={C.sunken} />
            <Text style={[st.small, { flex: 1 }]}>
              Visits you record stay on this phone until the clinic confirms
              them.
            </Text>
          </Card>
        )}
        {visits.map(x => (
          <VisitCard
            key={x.id}
            visit={x.visit!}
            patient={patients.find(p => p.resource.id === x.visit!.patientId)}
            footer={
              <View
                style={[
                  st.row,
                  { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
                ]}
              >
                <Delivery sent={x} />
                <SyncedPill synced={x.synced} />
              </View>
            }
          />
        ))}

        <Section title="Electronic health record" />
        <SyncCard pending={s.sent.filter(x => x.synced === 'pending').length} />
        <Section title="Carried for others" />
        <CarriedCard />
      </Scroll>
    </View>
  );
}

function Delivery({ sent }: { sent: Sent }) {
  return sent.delivered ? (
    <Pill text="At the clinic" icon={CircleCheck} tone="success" />
  ) : (
    <Pill text="On this phone, finding a route" icon={Clock} />
  );
}

function Scanner({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const [error, setError] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: C.ink }}>
      {/* No showFrame: its viewfinder is shaped for 1D barcodes, and camera-kit
          drops any code not wholly inside it, so a QR on a phone never scans.
          The square below is only a guide; codes anywhere in view count. */}
      <Camera
        style={{ flex: 1 }}
        cameraType={CameraType.Back}
        scanBarcode
        onReadCode={e => {
          if (busy.current) return;
          busy.current = true;
          enroll(e.nativeEvent.codeStringValue).then(onDone, err => {
            setError(err instanceof Error ? err.message : String(err));
            setTimeout(() => (busy.current = false), 1500);
          });
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.85)',
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: insets.top + 14,
          gap: 10,
        }}
      >
        <Text style={[st.screenTitle, { color: '#FFFFFF', flex: 0 }]}>
          Scan the clinic's code
        </Text>
        {!!error && (
          <View
            style={[
              st.row,
              {
                gap: 8,
                backgroundColor: C.errorSoft,
                borderRadius: 6,
                padding: 10,
              },
            ]}
          >
            <Icon icon={TriangleAlert} color={C.error} size={16} />
            <Text style={[st.small, { flex: 1, color: C.error }]}>{error}</Text>
          </View>
        )}
      </View>
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        style={[
          st.row,
          {
            position: 'absolute',
            bottom: insets.bottom + 28,
            alignSelf: 'center',
            gap: 8,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 6,
            backgroundColor: C.surface,
          },
        ]}
      >
        <Icon icon={X} color={C.ink} size={16} />
        <Text style={[st.body, { fontFamily: F.medium }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}
