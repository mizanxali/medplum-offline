import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Risk } from '../domain/news2';
import { useStore } from '../state';

export const C = {
  bg: '#F5F3EE',
  card: '#FFFFFF',
  ink: '#17201C',
  muted: '#5F6B66',
  line: '#E3DED3',
  accent: '#1F5A4A',
  accentSoft: '#E4EEEA',
  band: '#17201C',
};

export const RISK: Record<Risk, { fg: string; bg: string; label: string }> = {
  low: { fg: '#2E7D4F', bg: '#E6F2EA', label: 'Low' },
  'low-medium': { fg: '#9A6411', bg: '#FBF1DC', label: 'Low-medium' },
  medium: { fg: '#C2510F', bg: '#FCE8DA', label: 'Medium' },
  high: { fg: '#B42318', bg: '#FBE4E2', label: 'High' },
};

export const short = (address: string) =>
  address ? `${address.slice(0, 8)}…${address.slice(-4)}` : '…';

/** The dark band on every screen: what the mesh is doing right now. */
export function StatusBand({
  title,
  onMenu,
}: {
  title: string;
  onMenu?: () => void;
}) {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const dot =
    s.status === 'on'
      ? s.neighbors.length
        ? '#4ADE80'
        : '#FACC15'
      : s.status === 'error'
      ? '#F87171'
      : '#9CA3AF';
  const line =
    s.status === 'on'
      ? `Bluetooth mesh · ${s.neighbors.length} nearby · no internet used`
      : s.status === 'starting'
      ? 'Starting the mesh…'
      : s.status === 'error'
      ? s.error
      : 'Mesh off';
  return (
    <View style={[st.band, { paddingTop: insets.top + 10 }]}>
      <View style={st.row}>
        <Text style={st.bandTitle}>{title}</Text>
        {onMenu && (
          <Pressable onPress={onMenu} hitSlop={12}>
            <Text style={st.bandMenu}>Reset</Text>
          </Pressable>
        )}
      </View>
      <View style={[st.row, { marginTop: 6 }]}>
        <View style={[st.dot, { backgroundColor: dot }]} />
        <Text style={st.bandLine} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </View>
  );
}

export function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[st.label, style]}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'plain';
  disabled?: boolean;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        st.button,
        primary ? st.buttonPrimary : st.buttonPlain,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[st.buttonText, { color: primary ? '#fff' : C.accent }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({
  text,
  fg,
  bg,
}: {
  text: string;
  fg: string;
  bg: string;
}) {
  return (
    <View style={[st.chip, { backgroundColor: bg }]}>
      <Text style={[st.chipText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function RiskChip({ risk, total }: { risk: Risk; total: number }) {
  const r = RISK[risk];
  return <Chip text={`NEWS2 ${total} · ${r.label}`} fg={r.fg} bg={r.bg} />;
}

export const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center' },
  band: { backgroundColor: C.band, paddingHorizontal: 16, paddingBottom: 12 },
  bandTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  bandMenu: { color: '#A7B3AE', fontSize: 13, fontWeight: '600' },
  bandLine: { flex: 1, color: '#C9D2CE', fontSize: 12.5 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 14,
    gap: 8,
  },
  title: { color: C.ink, fontSize: 17, fontWeight: '700' },
  body: { color: C.ink, fontSize: 15, lineHeight: 21 },
  small: { color: C.muted, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: 'Menlo', fontSize: 12, color: C.muted },
  num: { fontVariant: ['tabular-nums'] },
  button: { borderRadius: 6, paddingVertical: 14, alignItems: 'center' },
  buttonPrimary: { backgroundColor: C.accent },
  buttonPlain: { backgroundColor: C.accentSoft },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
});
