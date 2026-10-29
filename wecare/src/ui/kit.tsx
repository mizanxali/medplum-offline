import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Risk } from '../domain/news2';
import { useStore } from '../state';

// Calm palette: pastel blue surfaces, one deep maroon accent, and state
// colours kept for state alone (green means done, red means wrong or urgent).
export const C = {
  bg: '#E8F0F8',
  surface: '#F7FAFD',
  sunken: '#EDF3F9',
  line: '#D6E2ED',
  ink: '#1D2733',
  muted: '#5E6B78',
  faint: '#8A96A3',
  accent: '#6E1F30',
  accentPressed: '#56172A',
  accentSoft: '#F3E6E9',
  success: '#1D6A42',
  successSoft: '#E1F0E7',
  error: '#E1302A',
  errorSoft: '#FDE8E6',
  amber: '#9C6512',
  amberSoft: '#FBF1DD',
  orange: '#C2541A',
  orangeSoft: '#FCEADD',
};

// Fonts are referenced by PostScript name, which is also the file name, so
// iOS and Android resolve them the same way. Never pair them with fontWeight:
// Android then falls back to the system font.
// Neuton for titles, Host Grotesk for everything else. The Host Grotesk files
// are static instances whose internal family reads "Host Grotesk Light"
// whatever their weight; the names below are those PostScript names.
export const F = {
  title: 'Neuton-Bold',
  heading: 'Neuton-Regular',
  body: 'HostGroteskLight-Regular',
  medium: 'HostGroteskLight-Medium',
  strong: 'HostGroteskLight-SemiBold',
};

export const RISK: Record<Risk, { fg: string; bg: string; label: string }> = {
  low: { fg: C.success, bg: C.successSoft, label: 'Low' },
  'low-medium': { fg: C.amber, bg: C.amberSoft, label: 'Low-medium' },
  medium: { fg: C.orange, bg: C.orangeSoft, label: 'Medium' },
  high: { fg: C.error, bg: C.errorSoft, label: 'High' },
};

export const short = (address: string) =>
  address ? `${address.slice(0, 8)}…${address.slice(-4)}` : '…';

/** Every icon in the app: one set, one stroke, sizes from a short list. */
export function Icon({
  icon: I,
  color = C.ink,
  size = 18,
}: {
  icon: LucideIcon;
  color?: string;
  size?: 14 | 16 | 18 | 20 | 24;
}) {
  return <I color={color} size={size} strokeWidth={1.75} />;
}

/** An icon on a soft tinted tile, used to lead rows and options. */
export function IconTile({
  icon,
  color = C.accent,
  bg = C.accentSoft,
}: {
  icon: LucideIcon;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[st.tile, { backgroundColor: bg }]}>
      <Icon icon={icon} color={color} size={20} />
    </View>
  );
}

/** Screen header: the title, and a quiet line saying what the mesh is doing. */
export function Header({
  title,
  right,
  showStatus = true,
}: {
  title: string;
  right?: React.ReactNode;
  showStatus?: boolean;
}) {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const status =
    s.status === 'on'
      ? {
          color: C.success,
          text: `Mesh on · ${s.neighbors.length} nearby · no internet needed`,
        }
      : s.status === 'starting'
      ? { color: C.faint, text: 'Starting the mesh…' }
      : s.status === 'error'
      ? { color: C.error, text: s.error }
      : { color: C.faint, text: 'Mesh off' };
  return (
    <View style={[st.header, { paddingTop: insets.top + 12 }]}>
      <View style={st.row}>
        <Text style={st.screenTitle} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      {showStatus && (
        <View style={[st.row, { marginTop: 6, gap: 8 }]}>
          <View style={[st.dot, { backgroundColor: status.color }]} />
          <Text
            style={[
              st.small,
              { flex: 1 },
              s.status === 'error' && { color: C.error },
            ]}
            numberOfLines={2}
          >
            {status.text}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A quiet text button for the header (Reset, Cancel). */
export function HeaderAction({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      style={({ pressed }) => [st.row, { gap: 6, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon icon={icon} color={C.muted} size={16} />
      <Text style={[st.small, { fontFamily: F.medium }]}>{label}</Text>
    </Pressable>
  );
}

/** Screen body: scrolls, and keeps its end clear of the home indicator or nav bar. */
export function Scroll({ children, ...props }: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...props}
      contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 40 }]}
    >
      {children}
    </ScrollView>
  );
}

/** Section heading: serif, sentence case, with an optional count. */
export function Section({
  title,
  count,
  right,
}: {
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <View style={[st.row, { marginTop: 10, marginBottom: -2 }]}>
      <Text style={st.sectionTitle}>{title}</Text>
      {count !== undefined && <Text style={st.count}>{count}</Text>}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
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
  icon,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  icon?: LucideIcon;
  kind?: 'primary' | 'soft';
  disabled?: boolean;
}) {
  const primary = kind === 'primary';
  const fg = primary ? '#FFFFFF' : C.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        st.button,
        {
          backgroundColor: primary
            ? pressed
              ? C.accentPressed
              : C.accent
            : C.accentSoft,
        },
        disabled && { opacity: 0.4 },
        pressed && !primary && { opacity: 0.75 },
      ]}
    >
      {icon && <Icon icon={icon} color={fg} size={18} />}
      <Text style={[st.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** A small status pill. `tone` picks the meaning, not the look. */
export function Pill({
  text,
  icon,
  tone = 'neutral',
}: {
  text: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'success' | 'error' | 'accent';
}) {
  const t = {
    neutral: { fg: C.muted, bg: C.sunken },
    success: { fg: C.success, bg: C.successSoft },
    error: { fg: C.error, bg: C.errorSoft },
    accent: { fg: C.accent, bg: C.accentSoft },
  }[tone];
  return <Tag text={text} icon={icon} fg={t.fg} bg={t.bg} />;
}

export function Tag({
  text,
  icon,
  fg,
  bg,
}: {
  text: string;
  icon?: LucideIcon;
  fg: string;
  bg: string;
}) {
  return (
    <View style={[st.pill, { backgroundColor: bg }]}>
      {icon && <Icon icon={icon} color={fg} size={14} />}
      <Text style={[st.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function RiskPill({ risk, total }: { risk: Risk; total: number }) {
  const r = RISK[risk];
  return <Tag text={`NEWS2 ${total} · ${r.label}`} fg={r.fg} bg={r.bg} />;
}

const soft: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#2B4A6B',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  default: { elevation: 1 },
}) as ViewStyle;

export const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 18, paddingBottom: 48, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { paddingHorizontal: 18, paddingBottom: 14, backgroundColor: C.bg },
  screenTitle: {
    flex: 1,
    fontFamily: F.title,
    fontSize: 32,
    color: C.ink,
    letterSpacing: -0.2,
  },
  sectionTitle: { fontFamily: F.heading, fontSize: 23, color: C.ink },
  count: {
    fontFamily: F.medium,
    fontSize: 13,
    color: C.muted,
    marginLeft: 8,
    marginTop: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 16,
    gap: 10,
    ...soft,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: F.heading, fontSize: 21, color: C.ink },
  body: { fontFamily: F.body, fontSize: 15.5, lineHeight: 22, color: C.ink },
  small: { fontFamily: F.body, fontSize: 13.5, lineHeight: 19, color: C.muted },
  label: { fontFamily: F.medium, fontSize: 12.5, color: C.muted },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
    color: C.muted,
  },
  num: { fontVariant: ['tabular-nums'] },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 6,
    paddingVertical: 14,
  },
  buttonText: { fontFamily: F.strong, fontSize: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: { fontFamily: F.medium, fontSize: 12.5 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: F.body,
    fontSize: 16,
    color: C.ink,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
});
