import {
  ArrowRight,
  Building2,
  CircleCheck,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { start } from '../mesh';
import { setState, type Role } from '../state';
import {
  Button,
  C,
  Card,
  Header,
  Icon,
  IconTile,
  Scroll,
  Section,
  st,
} from './kit';

const ROLES: {
  role: Role;
  icon: LucideIcon;
  title: string;
  body: string;
  placeholder: string;
}[] = [
  {
    role: 'chw',
    icon: HeartPulse,
    title: 'Health worker',
    body: 'Visit households, record vitals and see an early-warning score on the spot.',
    placeholder: 'Your name, for example Ada',
  },
  {
    role: 'clinic',
    icon: Building2,
    title: 'Clinic hub',
    body: 'Enroll health workers, receive their visits without signal, and pass them to the EHR.',
    placeholder: 'Clinic name, for example Riverside Clinic',
  },
];

export function Welcome() {
  const [role, setRole] = useState<Role>('chw');
  const [name, setName] = useState('');
  const chosen = ROLES.find(r => r.role === role)!;

  return (
    <View style={st.screen}>
      <Header title="WeCare" showStatus={false} />
      <Scroll keyboardShouldPersistTaps="handled">
        <Text style={[st.body, { color: C.muted }]}>
          Home visits that reach the clinic with no signal. Phones pass sealed
          records to one another over Bluetooth until one arrives.
        </Text>

        <Section title="This phone is for" />
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
                style={[
                  { flexDirection: 'row', gap: 14, alignItems: 'center' },
                  on && { borderColor: C.accent, borderWidth: 1.5 },
                ]}
              >
                <IconTile icon={r.icon} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.title}>{r.title}</Text>
                  <Text style={st.small}>{r.body}</Text>
                </View>
                <View style={{ width: 22, alignItems: 'center' }}>
                  {on ? (
                    <Icon icon={CircleCheck} color={C.accent} size={20} />
                  ) : (
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 1.5,
                        borderColor: C.line,
                      }}
                    />
                  )}
                </View>
              </Card>
            </Pressable>
          );
        })}

        <Section title="Name" />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={chosen.placeholder}
          placeholderTextColor={C.faint}
          maxLength={40}
          style={st.input}
        />
        <View style={{ height: 4 }} />
        <Button
          title="Start"
          icon={ArrowRight}
          disabled={!name.trim()}
          onPress={() => {
            setState(s => ({ ...s, role, name: name.trim() }));
            start();
          }}
        />
      </Scroll>
    </View>
  );
}
