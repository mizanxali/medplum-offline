import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { start } from '../mesh';
import { setState, type Role } from '../state';
import { Button, C, Card, Label, StatusBand, st } from './kit';

const ROLES: {
  role: Role;
  title: string;
  body: string;
  placeholder: string;
}[] = [
  {
    role: 'chw',
    title: 'Health worker',
    body: 'Visit households, record vitals and get an early-warning score on the phone. Records reach the clinic over other phones, sealed.',
    placeholder: 'Your name, e.g. Ada',
  },
  {
    role: 'clinic',
    title: 'Clinic hub',
    body: 'Enroll health workers with a QR code, receive their visits with no signal, and send them to the EHR when the internet is back.',
    placeholder: 'Clinic name, e.g. Riverside Clinic',
  },
];

export function Welcome() {
  const [role, setRole] = useState<Role>('chw');
  const [name, setName] = useState('');
  const chosen = ROLES.find(r => r.role === role)!;

  return (
    <View style={st.screen}>
      <StatusBand title="CareRounds" />
      <ScrollView
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[st.body, { color: C.muted }]}>
          Community health visits with no signal. Phones pass sealed records to
          each other over Bluetooth until one reaches the clinic.
        </Text>
        <Label>This phone is a</Label>
        {ROLES.map(r => {
          const on = r.role === role;
          return (
            <Pressable
              key={r.role}
              onPress={() => setRole(r.role)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Card
                style={
                  on && { borderColor: C.accent, borderWidth: 2, padding: 13 }
                }
              >
                <View style={st.row}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: on ? C.accent : C.line,
                      backgroundColor: on ? C.accent : 'transparent',
                      marginRight: 10,
                    }}
                  />
                  <Text style={st.title}>{r.title}</Text>
                </View>
                <Text style={st.small}>{r.body}</Text>
              </Card>
            </Pressable>
          );
        })}
        <Label>Name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={chosen.placeholder}
          placeholderTextColor="#9AA39F"
          maxLength={40}
          style={[st.card, st.body, { paddingVertical: 12 }]}
        />
        <Button
          title="Start"
          disabled={!name.trim()}
          onPress={() => {
            setState(s => ({ ...s, role, name: name.trim() }));
            start();
          }}
        />
      </ScrollView>
    </View>
  );
}
