import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Calm easing: a long, soft settle, never an overshoot. */
export const soft = Easing.bezier(0.22, 1, 0.36, 1);

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

/** Text that rises in softly at `at` seconds: a slow fade, a short lift, a breath of blur. */
export const Fade = ({ s, at, children, style }: { s: number; at: number; children: React.ReactNode; style?: React.CSSProperties }) => {
  const r = interpolate(s, [at, at + 0.9], [0, 1], { ...clamp, easing: soft });
  return <span style={{ opacity: r, translate: `0 ${(1 - r) * 16}px`, filter: `blur(${(1 - r) * 3}px)`, whiteSpace: "nowrap", ...style }}>{children}</span>;
};
