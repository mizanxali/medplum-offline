import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "./theme";

const BOLD = F.strong;
const REGULAR = F.body;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Dark, slow-moving gradient wallpaper behind the phone. */
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
    <AbsoluteFill style={{ backgroundColor: "#050507", overflow: "hidden" }}>
      {blob("#5A1A2A88", 560 + 220 * Math.sin(t * 0.13), 380 + 120 * Math.cos(t * 0.11), 1400)}
      {blob("#16455E88", 1420 + 200 * Math.cos(t * 0.09), 640 + 140 * Math.sin(t * 0.12), 1300)}
      {blob("#2C3F5A66", 980 + 300 * Math.sin(t * 0.07 + 2), 980 + 80 * Math.cos(t * 0.1), 1200)}
    </AbsoluteFill>
  );
};

/** Slow Ken Burns drift on everything inside, so the frame never stops moving. */
export const Drift = ({ children }: { children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill
      style={{
        scale: String(1.015 + 0.015 * Math.sin(t * 0.3)),
        translate: `${10 * Math.sin(t * 0.21)}px ${6 * Math.cos(t * 0.17)}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Black gradient behind the caption band, fixed to the frame. */
export const Scrim = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(180deg, #00000000 0%, #00000000 62%, #000000B3 88%, #000000B3 100%)",
      pointerEvents: "none",
    }}
  />
);

/**
 * One feature beat's caption: the title lands big over the phone, then at 0.6 s
 * shrinks into the band. Description lines type in beneath it, each at its own
 * time (s), replacing the one before. Fades at the end.
 */
export const Caption = ({ title, lines }: { title: string; lines: [number, string][] }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = frame / fps;
  const land = interpolate(frame, [0, 0.3 * fps], [0, 1], { ...clamp, easing: outExpo });
  const move = interpolate(frame, [0.6 * fps, 1.1 * fps], [0, 1], { ...clamp, easing: inOut });
  const out = interpolate(frame, [durationInFrames - 0.6 * fps, durationInFrames - 0.25 * fps], [1, 0], clamp);
  const i = lines.reduce((last, [t], j) => (s >= t ? j : last), 0);
  const [at, line] = lines[i];
  const next = lines[i + 1]?.[0];
  const typed = Math.floor(interpolate(s, [at, at + line.length * 0.022], [0, line.length], clamp));
  const lineOpacity = next === undefined ? 1 : interpolate(s, [next - 0.2, next], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out, translate: `0 ${(1 - out) * 16}px` }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 930 - 34,
          textAlign: "center",
          fontFamily: BOLD,
          fontSize: 60,
          letterSpacing: -1.5,
          color: C.text,
          opacity: land,
          filter: `blur(${(1 - land) * 10}px)`,
          translate: `0 ${(1 - move) * -470 + (1 - land) * 14}px`,
          scale: String(1 + (1 - move) * 1.3),
          textShadow: "0 4px 40px #000000",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 990,
          textAlign: "center",
          fontFamily: REGULAR,
          fontSize: 36,
          color: "#FFFFFFCC",
          opacity: s < at ? 0 : lineOpacity,
        }}
      >
        {line.slice(0, typed)}
        <span style={{ opacity: 0 }}>{line.slice(typed)}</span>
      </div>
    </AbsoluteFill>
  );
};

/** The WeCare wordmark in the band as the phone enters. */
export const BandText = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(frame, [0, 0.4 * fps, durationInFrames - 0.4 * fps, durationInFrames], [0, 1, 1, 0], clamp),
      }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, top: 930 - 34, textAlign: "center", fontFamily: F.title, fontSize: 72, letterSpacing: 0, color: C.text }}>
        WeCare
      </div>
    </AbsoluteFill>
  );
};

/**
 * Kinetic type: each word snaps up from 12 px with a blur, at its own time (s).
 * After `exit` (s) the whole line shrinks and fades up and out.
 */
export const Words = ({
  words,
  exit,
  size = 150,
  children,
}: {
  words: [string, number][];
  exit?: number;
  size?: number;
  children?: React.ReactNode;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const leave = exit === undefined ? 0 : interpolate(frame, [exit * fps, (exit + 0.5) * fps], [0, 1], { ...clamp, easing: inOut });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      <div
        style={{
          display: "flex",
          gap: size * 0.28,
          opacity: 1 - leave,
          scale: String(1 - leave * 0.25),
          translate: `0 ${-leave * 80}px`,
        }}
      >
        {words.map(([w, at]) => {
          const k = interpolate(frame, [at * fps, at * fps + 0.18 * fps], [0, 1], { ...clamp, easing: outExpo });
          return (
            <span
              key={w}
              style={{
                fontFamily: BOLD,
                fontSize: size,
                letterSpacing: -size * 0.035,
                color: C.text,
                opacity: k,
                translate: `0 ${(1 - k) * 12}px`,
                filter: `blur(${(1 - k) * 12}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {children}
    </AbsoluteFill>
  );
};
