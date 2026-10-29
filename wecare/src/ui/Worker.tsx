import React, { useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enroll, resetDemo } from '../mesh';
import { useStore, type Sent } from '../state';
import { Button, C, Card, Chip, Label, StatusBand, st } from './kit';
import { CarriedCard, SyncCard, SyncedChip } from './shared';
import { VisitCard } from './VisitCard';
import { VisitForm } from './VisitForm';

export function Worker() {
  const s = useStore();
  const [screen, setScreen] = useState<'home' | 'scan' | 'visit'>('home');

  if (screen === 'scan') return <Scanner onDone={() => setScreen('home')} />;
  if (screen === 'visit') return <VisitForm onDone={() => setScreen('home')} />;

  const openScanner = async () => {
    if (Platform.OS === 'android') {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (r !== 'granted') return;
    }
    setScreen('scan');
  };

  return (
    <View style={st.screen}>
      <StatusBand
        title={s.name}
        onMenu={() =>
          Alert.alert(
            'Reset this phone?',
            'Clears the clinic enrollment and every visit on this phone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: resetDemo },
            ],
          )
        }
      />
      <ScrollView contentContainerStyle={st.scroll}>
        <Card>
          <Label>Clinic</Label>
          {!s.clinic && (
            <>
              <Text style={st.body}>
                Not enrolled. Ask the clinic to show its code, then scan it
                while you are in Bluetooth range of the clinic phone.
              </Text>
              <Button title="Scan clinic code" onPress={openScanner} />
            </>
          )}
          {s.clinic && (
            <>
              <Text style={st.title}>{s.clinic.name}</Text>
              <Text style={st.small}>
                {s.enrolled
                  ? 'Enrolled. Visits go to this clinic only, sealed for it alone.'
                  : 'Waiting for the clinic to accept. Stay in Bluetooth range for this step.'}
              </Text>
              {!s.enrolled && (
                <Button
                  title="Scan a different code"
                  kind="plain"
                  onPress={openScanner}
                />
              )}
            </>
          )}
        </Card>

        <Button title="New visit" onPress={() => setScreen('visit')} />

        <Label style={{ marginTop: 4 }}>Today's visits · {s.sent.length}</Label>
        {s.sent.length === 0 && (
          <Text style={st.small}>
            Record a visit; it is kept here until the clinic confirms it.
          </Text>
        )}
        {s.sent.map(x => (
          <VisitCard
            key={x.visit.id}
            visit={x.visit}
            footer={
              <View
                style={[
                  st.row,
                  { justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
                ]}
              >
                <Delivery sent={x} />
                <SyncedChip synced={x.synced} />
              </View>
            }
          />
        ))}

        <SyncCard pending={s.sent.filter(x => x.synced === 'pending').length} />
        <CarriedCard />
      </ScrollView>
    </View>
  );
}

function Delivery({ sent }: { sent: Sent }) {
  return sent.delivered ? (
    <Chip text="✓ At the clinic" fg={C.accent} bg={C.accentSoft} />
  ) : (
    <Chip
      text="On this phone · waiting for a route"
      fg="#9A6411"
      bg="#FBF1DC"
    />
  );
}

function Scanner({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const [error, setError] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Camera
        style={{ flex: 1 }}
        cameraType={CameraType.Back}
        scanBarcode
        showFrame
        laserColor="#4ADE80"
        frameColor="#FFFFFF"
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
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: insets.top + 12,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
          Scan the clinic's code
        </Text>
        {!!error && (
          <Text style={{ color: '#FCA5A5', fontSize: 14 }}>{error}</Text>
        )}
      </View>
      <Pressable
        onPress={onDone}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          alignSelf: 'center',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 6,
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      >
        <Text style={{ fontWeight: '700', color: C.ink }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
