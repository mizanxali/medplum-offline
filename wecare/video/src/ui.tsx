import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { interpolate } from "remotion";
import type { Risk } from "../../src/domain/news2";
import { C, F, RISK, T } from "./theme";

export const SCREEN_W = 390;
export const SCREEN_H = 844;
const BEZEL = 12;
export const PHONE_W = SCREEN_W + BEZEL * 2;
export const PHONE_H = SCREEN_H + BEZEL * 2;
/** Top of the app header's content: the status bar inset plus the header's 12 px. */
export const INSET = 59;

// ---------------------------------------------------------------- the app's kit, as HTML

export const row = (gap = 0, style?: CSSProperties): CSSProperties => ({ display: "flex", flexDirection: "row", alignItems: "center", gap, ...style });
export const col = (gap = 0, style?: CSSProperties): CSSProperties => ({ display: "flex", flexDirection: "column", gap, ...style });

export const Icon = ({ icon: I, color = C.ink, size = 18 }: { icon: LucideIcon; color?: string; size?: number }) => (
  <I color={color} size={size} strokeWidth={1.75} style={{ flexShrink: 0 }} />
);

export const IconTile = ({ icon, color = C.accent, bg = C.accentSoft }: { icon: LucideIcon; color?: string; bg?: string }) => (
  <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Icon icon={icon} color={color} size={20} />
  </div>
);

export const Card = ({ children, style, accent }: { children: ReactNode; style?: CSSProperties; accent?: boolean }) => (
  <div
    style={{
      backgroundColor: C.surface,
      borderRadius: 8,
      border: accent ? `1.5px solid ${C.accent}` : `0.5px solid ${C.line}`,
      padding: 16,
      boxShadow: "0 3px 10px #3B6E8012",
      ...col(10),
      ...style,
    }}
  >
    {children}
  </div>
);

export const Section = ({ title, count, right }: { title: string; count?: number; right?: ReactNode }) => (
  <div style={row(0, { marginTop: 10, marginBottom: -2 })}>
    <span style={T.sectionTitle}>{title}</span>
    {count !== undefined && <span style={T.count}>{count}</span>}
    <div style={{ flex: 1 }} />
    {right}
  </div>
);

export const Button = ({ title, icon, kind = "primary", pressed, disabled }: { title: string; icon?: LucideIcon; kind?: "primary" | "soft"; pressed?: boolean; disabled?: boolean }) => {
  const primary = kind === "primary";
  const fg = primary ? "#FFFFFF" : C.accent;
  return (
    <div
      style={{
        ...row(8, { justifyContent: "center" }),
        borderRadius: 6,
        padding: "14px 0",
        backgroundColor: primary ? (pressed ? C.accentPressed : C.accent) : C.accentSoft,
        opacity: disabled ? 0.4 : pressed && !primary ? 0.75 : 1,
      }}
    >
      {icon && <Icon icon={icon} color={fg} size={18} />}
      <span style={{ ...T.buttonText, color: fg }}>{title}</span>
    </div>
  );
};

export const Tag = ({ text, icon, fg, bg, style }: { text: string; icon?: LucideIcon; fg: string; bg: string; style?: CSSProperties }) => (
  <div style={{ ...row(5), alignSelf: "flex-start", borderRadius: 6, padding: "4px 8px", backgroundColor: bg, ...style }}>
    {icon && <Icon icon={icon} color={fg} size={14} />}
    <span style={{ ...T.pillText, color: fg, whiteSpace: "nowrap" }}>{text}</span>
  </div>
);

const TONE = {
  neutral: { fg: C.muted, bg: C.sunken },
  success: { fg: C.success, bg: C.successSoft },
};
export const Pill = ({ text, icon, tone = "neutral", style }: { text: string; icon?: LucideIcon; tone?: keyof typeof TONE; style?: CSSProperties }) => (
  <Tag text={text} icon={icon} {...TONE[tone]} style={style} />
);

export const RiskPill = ({ risk, total }: { risk: Risk; total: number }) => {
  const r = RISK[risk];
  return <Tag text={`NEWS2 ${total} · ${r.label}`} fg={r.fg} bg={r.bg} />;
};

export const HeaderAction = ({ icon, label }: { icon: LucideIcon; label: string }) => (
  <div style={row(6)}>
    <Icon icon={icon} color={C.muted} size={16} />
    <span style={{ ...T.small, fontFamily: F.medium }}>{label}</span>
  </div>
);

/** Screen header: the title, and a quiet line saying what the mesh is doing. */
export const Header = ({ title, right, nearby }: { title: string; right?: ReactNode; nearby?: number }) => (
  <div style={{ padding: `${INSET + 12}px 18px 14px`, backgroundColor: C.bg }}>
    <div style={row()}>
      <span style={{ ...T.screenTitle, flex: 1 }}>{title}</span>
      {right}
    </div>
    {nearby !== undefined && (
      <div style={row(8, { marginTop: 6 })}>
        <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.success }} />
        <span style={T.small}>Mesh on · {nearby} nearby · no internet needed</span>
      </div>
    )}
  </div>
);

/** iOS status bar in dark ink. No cellular signal; Wi-Fi fades in with `wifi` (0 … 1). */
export const StatusBar = ({ wifi = 0, light }: { wifi?: number; light?: boolean }) => {
  const ink = light ? "#FFFFFF" : "#000000";
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        zIndex: 2,
        ...row(0, { justifyContent: "space-between" }),
        padding: "6px 34px 0 46px",
        fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: ink,
      }}
    >
      <span>10:42</span>
      <div style={row(6)}>
        <svg width="18" height="12" viewBox="0 0 18 12">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 5} y={9 - i * 3} width="3" height={3 + i * 3} rx="1" fill={ink} opacity={0.25} />
          ))}
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" style={{ opacity: wifi, scale: String(0.6 + 0.4 * wifi) }}>
          <path d="M8 11.5 L5.6 9 A3.4 3.4 0 0 1 10.4 9 Z" fill={ink} />
          <path d="M3.3 6.7 A6.6 6.6 0 0 1 12.7 6.7" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M1 4.3 A9.9 9.9 0 0 1 15 4.3" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
        <div style={{ width: 25, height: 12, borderRadius: 4, border: `1px solid ${ink}66`, padding: 1.5 }}>
          <div style={{ width: "70%", height: "100%", borderRadius: 2, backgroundColor: ink }} />
        </div>
      </div>
    </div>
  );
};

/**
 * An app screen: a fixed header and a body that scrolls by `scroll` px, with the
 * app's 18 px side padding and 12 px gap.
 */
export const Screen = ({ header, children, scroll = 0, wifi, overlay }: { header: ReactNode; children: ReactNode; scroll?: number; wifi?: number; overlay?: ReactNode }) => (
  <div style={{ position: "absolute", inset: 0, backgroundColor: C.bg, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, ...col() }}>
      <div style={{ position: "relative", zIndex: 1 }}>{header}</div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div style={{ ...col(12), padding: "0 18px 48px", translate: `0 ${-scroll}px` }}>{children}</div>
      </div>
    </div>
    {overlay}
    <StatusBar wifi={wifi} />
  </div>
);

/** iOS light keyboard, sliding up by `show` (0 … 1). */
export const Keyboard = ({ show, pressed }: { show: number; pressed?: string }) => {
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 291,
        backgroundColor: "#D1D4DA",
        translate: `0 ${(1 - show) * 291}px`,
        padding: "8px 3px 0",
        ...col(11),
      }}
    >
      {rows.map((r, i) => (
        <div key={r} style={{ display: "flex", justifyContent: "center", gap: 6, padding: i === 1 ? "0 18px" : 0 }}>
          {i === 2 && <Key w={44} dark label="⇧" lit={!!pressed && /[A-Z]/.test(pressed)} />}
          {[...r].map((k) => (
            <Key key={k} label={k} lit={pressed?.toLowerCase() === k} />
          ))}
          {i === 2 && <Key w={44} dark label="⌫" />}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <Key w={92} dark label="123" />
        <Key w={190} label={pressed === " " ? "" : "space"} lit={pressed === " "} />
        <Key w={92} dark label="done" />
      </div>
    </div>
  );
};

const Key = ({ label, w = 33, dark, lit }: { label?: string; w?: number; dark?: boolean; lit?: boolean }) => (
  <div
    style={{
      width: w,
      height: 42,
      borderRadius: 5,
      backgroundColor: lit ? "#B5B9C1" : dark ? "#ACB1BA" : "#FFFFFF",
      boxShadow: "0 1px 0 #898A8D",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
      fontSize: label && label.length > 1 ? 15 : 22,
      color: "#000",
      scale: lit ? "1.15" : "1",
    }}
  >
    {label}
  </div>
);

/**
 * The device: bezel, rounded screen, dynamic island. `dim` (0 … 1) lays a pastel veil
 * over the whole screen, above the header and status bar, while a title lands.
 */
export const Phone = ({ children, dim = 0, style }: { children: ReactNode; dim?: number; style?: CSSProperties }) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      width: PHONE_W,
      height: PHONE_H,
      marginLeft: -PHONE_W / 2,
      marginTop: -PHONE_H / 2,
      borderRadius: 64,
      backgroundColor: "#0B0B0C",
      border: "2px solid #3A3A3C",
      boxShadow: "0 30px 90px #1D273338, 0 8px 24px #1D27331F, inset 0 0 0 1px #000",
      padding: BEZEL - 2,
      ...style,
    }}
  >
    <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, borderRadius: 52, overflow: "hidden", backgroundColor: C.bg }}>
      {children}
      <div style={{ position: "absolute", top: 11, left: SCREEN_W / 2 - 62, width: 124, height: 36, borderRadius: 18, backgroundColor: "#000" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 20, backgroundColor: "#EEF5F8", opacity: dim, pointerEvents: "none" }} />
    </div>
  </div>
);

// ---------------------------------------------------------------- touch dot

/**
 * A soft touch dot in screen points. `path` is [frame, x, y] keyframes (eased between),
 * `taps` are the frames where it presses. Ink-tinted, since the app is light.
 */
export const TouchDot = ({ frame, path, taps, show }: { frame: number; path: [number, number, number][]; taps: number[]; show: [number, number] }) => {
  const fs = path.map((p) => p[0]);
  const ease = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut } as const;
  const x = path.length > 1 ? interpolate(frame, fs, path.map((p) => p[1]), ease) : path[0][1];
  const y = path.length > 1 ? interpolate(frame, fs, path.map((p) => p[2]), ease) : path[0][2];
  const press = Math.max(0, ...taps.map((t) => interpolate(frame, [t - 4, t, t + 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const ripple = taps.find((t) => frame >= t && frame < t + 24);
  const opacity = interpolate(frame, [show[0], show[0] + 8, show[1] - 8, show[1]], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, opacity, pointerEvents: "none", zIndex: 10 }}>
        {ripple !== undefined && (
          <div
            style={{
              position: "absolute",
              width: 44,
              height: 44,
              left: -22,
              top: -22,
              borderRadius: 22,
              border: `2px solid ${C.ink}`,
              opacity: interpolate(frame - ripple, [0, 24], [0.5, 0]),
              scale: String(interpolate(frame - ripple, [0, 24], [0.6, 1.8])),
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            width: 34,
            height: 34,
            left: -17,
            top: -17,
            borderRadius: 17,
            backgroundColor: "#1D273355",
            border: "1.5px solid #FFFFFF",
            boxShadow: "0 4px 18px #1D273355",
            scale: String(1 - press * 0.22),
          }}
        />
      </div>
    </>
  );
};

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
