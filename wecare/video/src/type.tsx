import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Calm easing: a long, soft settle, never an overshoot. */
export const soft = Easing.bezier(0.22, 1, 0.36, 1);
const inOut = Easing.bezier(0.45, 0, 0.55, 1);

/** Light, slow-moving pastel wallpaper in the app's own sky blue, with a warm blush. */
export const Wallpaper = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const blob = (color: string, x: number, y: number, size: number) => (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, ${color}00 70%)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #F4F9FB 0%, #E3EFF4 100%)", overflow: "hidden" }}>
      {blob("#CFE4EE", 520 + 160 * Math.sin(t * 0.08), 360 + 90 * Math.cos(t * 0.07), 1400)}
      {blob("#F3E6E9", 1440 + 140 * Math.cos(t * 0.06), 660 + 100 * Math.sin(t * 0.08), 1200)}
      {blob("#FBF4EA", 960 + 220 * Math.sin(t * 0.05 + 2), 1000 + 60 * Math.cos(t * 0.07), 1300)}
    </AbsoluteFill>
  );
};

/** Slow Ken Burns drift on everything inside, so the frame never stops moving. */
export const Drift = ({ children }: { children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ scale: String(1.012 + 0.01 * Math.sin(t * 0.2)), translate: `${8 * Math.sin(t * 0.14)}px ${5 * Math.cos(t * 0.11)}px` }}>
      {children}
    </AbsoluteFill>
  );
};

/** A soft pastel band behind the captions, fixed to the frame. */
export const Scrim = () => (
  <AbsoluteFill style={{ background: "linear-gradient(180deg, #F2F7F900 0%, #F2F7F900 64%, #F2F7F9E0 86%, #F2F7F9F2 100%)", pointerEvents: "none" }} />
);

/** When a beat's title has settled into the band; the phone's veil and the first line wait for it. */
export const TITLE_SETTLED = 1.4;

/**
 * One feature beat's caption: the title rises in softly over the phone, then
 * settles into the band. Description lines fade in beneath it, each at its own
 * time (s), replacing the one before. Fades at the end.
 */
export const Caption = ({ title, lines }: { title: string; lines: [number, string][] }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = frame / fps;
  const land = interpolate(s, [0, 0.6], [0, 1], { ...clamp, easing: soft });
  const move = interpolate(s, [0.8, TITLE_SETTLED], [0, 1], { ...clamp, easing: inOut });
  const out = interpolate(frame, [durationInFrames - 0.7 * fps, durationInFrames - 0.25 * fps], [1, 0], clamp);
  const starts = lines.map(([t], j) => (j === 0 ? Math.max(t, TITLE_SETTLED - 0.1) : t));
  const i = starts.reduce((last, t, j) => (s >= t ? j : last), 0);
  const at = starts[i];
  const next = starts[i + 1];
  const enter = interpolate(s, [at, at + 0.5], [0, 1], { ...clamp, easing: soft });
  const leave = next === undefined ? 0 : interpolate(s, [next - 0.3, next], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: out, translate: `0 ${(1 - out) * 12}px` }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 930 - 40,
          textAlign: "center",
          fontFamily: F.title,
          fontSize: 64,
          color: C.ink,
          opacity: land,
          translate: `0 ${(1 - move) * -470 + (1 - land) * 18}px`,
          scale: String(1 + (1 - move) * 0.9),
          textShadow: `0 2px 30px ${C.bg}`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1000,
          textAlign: "center",
          fontFamily: F.body,
          fontSize: 34,
          color: C.muted,
          opacity: s < at ? 0 : enter * (1 - leave),
          translate: `0 ${(1 - enter) * 8}px`,
        }}
      >
        {lines[i][1]}
      </div>
    </AbsoluteFill>
  );
};

/** The WeCare wordmark in the band as the phone enters. */
export const BandText = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [0, 0.6 * fps, durationInFrames - 0.5 * fps, durationInFrames], [0, 1, 1, 0], clamp) }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 930 - 40, textAlign: "center", fontFamily: F.title, fontSize: 72, color: C.ink }}>WeCare</div>
    </AbsoluteFill>
  );
};

/** Text that rises in softly at `at` seconds: a slow fade, a short lift, a breath of blur. */
export const Fade = ({ s, at, children, style }: { s: number; at: number; children: React.ReactNode; style?: React.CSSProperties }) => {
  const r = interpolate(s, [at, at + 0.9], [0, 1], { ...clamp, easing: soft });
  return <span style={{ opacity: r, translate: `0 ${(1 - r) * 16}px`, filter: `blur(${(1 - r) * 3}px)`, whiteSpace: "nowrap", ...style }}>{children}</span>;
};
