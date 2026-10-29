import { Lock, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, Freeze, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { ACTION, ADA, BEN, DETERIORATING, EARLIER, JOSEPH_VISIT, news2, NORMAL, RUTH, RUTH_VISIT, sickestFirst, type VisitView, type Vitals } from "./data";
import { ClinicScreen, ScannerScreen, VisitFormScreen, WelcomeScreen, WorkerHome, type Received } from "./screens";
import { C, F, RISK } from "./theme";
import { Fade, soft } from "./type";
import { Icon, Keyboard, Phone, TouchDot, Transition } from "./ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.55, 0, 1, 0.45);
/** The curve iOS uses for navigation: quick to start, long to settle. */
const ios = Easing.bezier(0.2, 0.9, 0.25, 1);
/** A screen change's progress, 0 → 1 between `a` and `b` seconds. */
const swap = (s: number, a: number, b: number) => k(s, a, b, ios);

const useClock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, s: frame / fps };
};

/** 0 → 1 between `a` and `b` seconds. */
const k = (s: number, a: number, b: number, easing = ease) => interpolate(s, [a, b], [0, 1], { ...clamp, easing });


// ---------------------------------------------------------------- camera

type Key = [sec: number, scale: number, tx: number, ty: number];
/** Frame y (relative to centre) where the action sits: a touch above the middle. */
const ACTION_Y = -20;
/** Calm framing: every punch-in goes a quarter less deep than the number asked for. */
const CALM = 0.75;
/** Camera that lands point (x, y), relative to the frame centre at scale 1, on the action spot. */
const aimAt = (sec: number, scale: number, x: number, y: number): Key => {
  const z = 1 + (scale - 1) * CALM;
  return [sec, z, -z * x, ACTION_Y - z * y];
};
/** Same, for screen point (sx, sy) on the centred phone. */
const aim = (sec: number, scale: number, sx: number, sy: number) => aimAt(sec, scale, sx - 195, sy - 422);
/** Same, for a screen point on a phone placed at [x, y, scale]. */
const aimOn = (sec: number, scale: number, [px, py, ps]: Place, sx: number, sy: number) => aimAt(sec, scale, px + (sx - 195) * ps, py + (sy - 422) * ps);
const home = (sec: number): Key => [sec, 1, 0, 0];

const Camera = ({ keys, shake = 0, children }: { keys: Key[]; shake?: number; children: ReactNode }) => {
  const { s } = useClock();
  const at = keys.map((key) => key[0]);
  const v = (i: number) => interpolate(s, at, keys.map((key) => key[i]), { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ scale: String(v(1)), translate: `${v(2) + shake * Math.sin(s * 90)}px ${v(3) + shake * Math.cos(s * 77)}px` }}>
      {children}
    </AbsoluteFill>
  );
};

/** Touch dot with times in seconds. */
const Touch = ({ path, taps, end }: { path: [number, number, number][]; taps: number[]; end: number }) => {
  const { frame, fps } = useClock();
  return <TouchDot frame={frame} path={path.map(([t, x, y]) => [t * fps, x, y])} taps={taps.map((t) => t * fps)} show={[path[0][0] * fps - 6, end * fps]} />;
};

/** Characters typed from `start`, one every `per` seconds. */
const typing = (text: string, s: number, start: number, per: number) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((s - start) / per) + 1));
  const pressed = n > 0 && n <= text.length && s - (start + (n - 1) * per) < per * 0.7 ? text[n - 1] : undefined;
  return { value: s >= start ? text.slice(0, n) : "", pressed: s >= start ? pressed : undefined };
};

const bump = (s: number, at: number) => interpolate(s - at, [0, 0.1, 0.35], [0, 1, 0], clamp);
/** How many of `taps` (seconds) have happened by `s`. */
const count = (s: number, taps: number[]) => taps.filter((t) => s >= t).length;
/** The control under a tap at `t` reads as held for 0.15 s. */
const held = (s: number, taps: number[]) => taps.some((t) => s >= t - 0.02 && s < t + 0.15);

// ---------------------------------------------------------------- multi-phone layouts

type Place = [x: number, y: number, scale: number];

const Placed = ({ at: [x, y, scale], children }: { at: Place; children: ReactNode }) => (
  <Phone style={{ translate: `${x}px ${y}px`, scale: String(scale) }}>
    {children}
  </Phone>
);

const lerp = (a: Place, b: Place, t: number): Place => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const CENTRE: Place = [0, 0, 1];
const P = 0.95; // phone scale in a split
const Y = 0;
const SPLIT = 250;
const LEFT: Place = [-SPLIT, Y, P];
const RIGHT: Place = [SPLIT, Y, P];
/** Far enough out that a phone stays hidden even while a feature intro scales the scene. */
const OFF = 1800;
const TRIO = 0.75;
const TY = 0;
const T_LEFT: Place = [-560, TY, TRIO];
const T_MID: Place = [0, TY, TRIO];
const T_RIGHT: Place = [560, TY, TRIO];

// ---------------------------------------------------------------- feature intro

/** How long a feature's intro runs before its own timeline takes over. */
export const LEAD = 4.8;
/** Where each beat's own timeline picks up (its first 0.6 s was the old title landing). */
const ACTION_FROM = 0.6;
/** Every beat runs LEAD − ACTION_FROM longer than its own timeline. */
export const INTRO_EXTRA = LEAD - ACTION_FROM;

type Side = "L" | "R";
const SIDE: Record<Side, Place> = { L: [-440, 0, 0.92], R: [440, 0, 0.92] };

/**
 * A feature's opening: the phone glides to one side and the title and description
 * come in on the other. After a read, the text slides out the way it came, and the
 * phone glides back into its place in the beat as the beat's own timeline starts.
 * `at` is where the beat's main phone stands when its timeline starts.
 */
export const Featured = ({ side, title, body, at = CENTRE, children }: { side: Side; title: string; body: string; at?: Place; children: ReactNode }) => {
  const { s, fps } = useClock();
  const [px, py, ps] = at;
  const [sx, sy, ss] = SIDE[side];
  // The whole scene is scaled by r and shifted by d, so the main phone sits at the
  // centre (as the last beat left it), then beside the text, then back in place.
  const r0 = 1 / ps;
  const r1 = ss / ps;
  const into = k(s, 0, 0.9, soft);
  const back = k(s, 4.0, LEAD);
  const r = r0 + (r1 - r0) * into + (1 - r1) * back;
  const d = (p: number, q: number) => -r0 * p + (q - r1 * p + r0 * p) * into + (r1 * p - q) * back;
  const textIn = k(s, 0.35, 1.25, soft);
  const textOut = k(s, 3.9, 4.6, easeIn);
  const dir = side === "L" ? 1 : -1; // the text sits opposite the phone and leaves toward its own edge
  const scene =
    s < LEAD ? (
      <Freeze frame={Math.round(ACTION_FROM * fps)}>{children}</Freeze>
    ) : (
      <Sequence from={Math.round((LEAD - ACTION_FROM) * fps)} layout="none">
        {children}
      </Sequence>
    );
  return (
    <>
      <AbsoluteFill style={{ scale: String(r), translate: `${d(px, sx)}px ${d(py, sy)}px` }}>{scene}</AbsoluteFill>
      {s < LEAD && (
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: side === "L" ? 990 : 190, paddingRight: side === "L" ? 150 : 950 }}>
          <div style={{ opacity: textIn * (1 - textOut), translate: `${dir * ((1 - textIn) * 50 + textOut * 900)}px 0`, display: "flex", flexDirection: "column", gap: 24 }}>
            <span style={{ fontFamily: F.title, fontSize: 78, lineHeight: 1.05, color: C.ink }}>{title}</span>
            <span style={{ fontFamily: F.body, fontSize: 34, lineHeight: 1.45, color: C.muted }}>{body}</span>
          </div>
        </AbsoluteFill>
      )}
    </>
  );
};

// ---------------------------------------------------------------- tap targets (screen points, measured from stills)

// Health worker home
const SCAN_BTN_Y = 268;
const NEW_VISIT_Y = 287; // once enrolled
// Welcome
const HW_CARD_Y = 311;
const CLINIC_CARD_Y = 441;
const NAME_Y = 585;
const START_Y = 662;
const WELCOME_SCROLL = 130;
// Clinic
const ENROLL = [112, 242] as const;
// New visit form
const RUTH_CHIP = [75, 445] as const;
const VITALS_SCROLL = 300;
const STEP_PLUS_X = 335;
const STEP_MINUS_X = 203;
const ROW_Y = (i: number) => 277 + i * 67.5; // vitals rows at VITALS_SCROLL
const ALERT_SCROLL = 560;
const CONFUSION = [142, 470] as const;
const PRESET_SCROLL = 230;
const DETERIORATING_BTN = [325, 283] as const;
const SAVE_SCROLL = 760;
const SAVE_Y = 389;

// ---------------------------------------------------------------- 0:00 cold open

const serif = { fontFamily: F.title, color: C.ink, lineHeight: 1.15 };

/** Two quiet lines that set the scene before the phone arrives. */
export const ColdOpen = () => {
  const { s } = useClock();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26, opacity: 1 - k(s, 3.1, 3.6), translate: `0 ${-90 - k(s, 3.1, 3.6) * 20}px` }}>
      <Fade s={s} at={0.3} style={{ ...serif, fontSize: 84 }}>
        Ruth lives an hour from the nearest clinic.
      </Fade>
      <Fade s={s} at={1.6} style={{ ...serif, fontFamily: F.heading, fontSize: 60, color: C.muted }}>
        There's no signal at the door.
      </Fade>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 0:04 phone enters

const EARLIER_RECEIVED: Received[] = EARLIER.map((v) => ({ v }));

export const PhoneEnter = () => {
  const { s } = useClock();
  return (
    <Camera keys={[[0, 0.94, 0, 0], [3, 1, 0, 0]]}>
      <Phone style={{ translate: `0 ${interpolate(s, [0, 0.9], [1100, 0], { ...clamp, easing: soft })}px` }}>
        <Transition p={swap(s, 2.3, 2.95)} kind="fade" from={<ClinicScreen nearby={2} workers={[ADA.name, BEN.name]} received={EARLIER_RECEIVED} scroll={150} />} to={<WelcomeScreen role="chw" name="" />} />
      </Phone>
    </Camera>
  );
};

// ---------------------------------------------------------------- 1 set up a phone

const NAME_START = 4.7;
const NAME_PER = 0.13;

export const SetupBeat = () => {
  const { s } = useClock();
  const role = s >= 1.8 && s < 3.0 ? "clinic" : "chw";
  const kb = k(s, 4.3, 4.6) - k(s, 6.2, 6.5);
  const scroll = WELCOME_SCROLL * k(s, 4.3, 4.6);
  const name = typing("Ada", s, NAME_START, NAME_PER);
  return (
    <Camera
      keys={[
        home(0),
        home(0.6),
        aim(1.1, 1.5, 195, 380),
        aim(3.6, 1.5, 195, 380),
        aim(4.4, 1.9, 195, NAME_Y - WELCOME_SCROLL),
        aim(6.0, 1.9, 195, NAME_Y - WELCOME_SCROLL),
        aim(6.5, 1.6, 195, START_Y - WELCOME_SCROLL - 40),
        aim(7.0, 1.6, 195, START_Y - WELCOME_SCROLL - 40),
        aim(7.8, 1.9, 150, 125),
        aim(9.2, 1.9, 150, 125),
        aim(10.0, 1.5, 195, 230),
        home(10.5),
      ]}
    >
      <Phone>
        <Transition
          p={swap(s, 6.95, 7.6)}
          kind="fade"
          from={
            <>
              <WelcomeScreen role={role} name={name.value} caret={s >= 4.2 && s < 6.2} pressed={held(s, [6.8])} scroll={scroll} />
              <Keyboard show={kb} pressed={name.pressed} />
            </>
          }
          to={<WorkerHome name={ADA.name} nearby={2} clinic="none" />}
        />
        {s < 7.2 && (
          <Touch
            path={[
              [1.3, 220, 560],
              [1.8, 200, CLINIC_CARD_Y],
              [2.5, 200, CLINIC_CARD_Y - 20],
              [3.0, 200, HW_CARD_Y],
              [3.7, 220, 450],
              [4.2, 200, NAME_Y],
              [5.6, 230, NAME_Y + 60],
              [6.3, 210, START_Y - WELCOME_SCROLL],
              [6.8, 195, START_Y - WELCOME_SCROLL],
            ]}
            taps={[1.8, 3.0, 4.2, 6.8]}
            end={7.1}
          />
        )}
      </Phone>
    </Camera>
  );
};

// ---------------------------------------------------------------- 2 enroll with a scan

export const EnrollBeat = () => {
  const { s } = useClock();
  const ada = lerp(RIGHT, CENTRE, k(s, 13.3, 13.9));
  const clinic: Place = [interpolate(s, [0.6, 1.25], [-OFF, -SPLIT], { ...clamp, easing: soft }) - interpolate(s, [13.3, 13.9], [0, 1500], { ...clamp, easing: easeIn }), Y, P];
  const adaState = s < 3.1 ? "none" : s < 7.1 ? "waiting" : "enrolled";
  const scanner = <ScannerScreen qr={k(s, 2.1, 2.8, out)} flash={interpolate(s, [2.85, 2.95, 3.15], [0, 1, 0], clamp)} />;
  const adaHome = <WorkerHome name={ADA.name} nearby={2} clinic={adaState} enrolled={k(s, 7.1, 7.45, out)} />;
  const request = k(s, 4.6, 5.0, out) * (1 - k(s, 6.95, 7.3));
  return (
    <Camera
      keys={[
        home(0),
        home(4.3),
        aimOn(4.9, 1.5, LEFT, 195, 260),
        aimOn(7.0, 1.5, LEFT, 195, 260),
        aimOn(7.6, 1.4, RIGHT, 195, 230),
        aimOn(9.0, 1.7, RIGHT, 195, 215),
        aimOn(12.4, 1.7, RIGHT, 195, 215),
        home(13.0),
      ]}
    >
      <Placed at={ada}>
        {s < 2.6 ? <Transition p={swap(s, 1.7, 2.3)} kind="present" from={adaHome} to={scanner} /> : <Transition p={swap(s, 3.1, 3.65)} kind="dismiss" from={scanner} to={adaHome} />}
        <Touch
          path={[
            [1.1, 230, 420],
            [1.6, 195, SCAN_BTN_Y],
          ]}
          taps={[1.6]}
          end={1.9}
        />
      </Placed>
      <Placed at={clinic}>
        <ClinicScreen nearby={2} request={request} enrollPressed={held(s, [6.8])} workers={s >= 7.0 ? [ADA.name] : []} showCode received={[]} />
        <Touch
          path={[
            [6.3, 150, 420],
            [6.8, ENROLL[0], ENROLL[1]],
          ]}
          taps={[6.8]}
          end={7.1}
        />
      </Placed>
    </Camera>
  );
};

// ---------------------------------------------------------------- 3 record the visit

const PLUS_TAPS = [5.4, 5.8, 6.2, 6.6, 7.0];
const MINUS_TAPS = [7.8, 8.2, 8.6];
/** Ada's vitals at `s` in the record beat. */
const recorded = (s: number): Vitals => ({ ...NORMAL, respRate: 16 + count(s, PLUS_TAPS), spo2: 97 - count(s, MINUS_TAPS) });
export const RECORDED = recorded(99);

export const RecordBeat = () => {
  const { s } = useClock();
  const scroll = VITALS_SCROLL * k(s, 4.4, 4.9);
  const pressed = held(s, PLUS_TAPS) ? "respRate+" : held(s, MINUS_TAPS) ? "spo2-" : undefined;
  return (
    <Camera
      keys={[
        home(0),
        home(0.6),
        aim(1.1, 1.5, 195, NEW_VISIT_Y),
        aim(1.7, 1.5, 195, NEW_VISIT_Y),
        aim(2.4, 1.4, 195, 380),
        aim(4.0, 1.4, 195, 380),
        aim(4.9, 1.55, 220, ROW_Y(0) + 40),
        aim(7.4, 1.55, 220, ROW_Y(0) + 40),
        aim(8.0, 1.55, 220, ROW_Y(1) + 20),
        aim(10.0, 1.4, 200, 300),
        aim(12.4, 1.4, 200, 300),
        home(12.9),
      ]}
    >
      <Phone>
        <Transition
          p={swap(s, 1.7, 2.25)}
          kind="push"
          from={<WorkerHome name={ADA.name} nearby={2} clinic="enrolled" enrolled={1} />}
          to={<VisitFormScreen patient={s >= 2.8 ? RUTH : undefined} v={recorded(s)} scroll={scroll} pressed={pressed} />}
        />
        {s < 1.85 && (
          <Touch
            path={[
              [1.1, 230, 420],
              [1.6, 195, NEW_VISIT_Y],
            ]}
            taps={[1.6]}
            end={1.85}
          />
        )}
        {s >= 1.85 && (
          <Touch
            path={[
              [2.2, 200, 520],
              [2.8, RUTH_CHIP[0], RUTH_CHIP[1]],
              [4.9, STEP_PLUS_X - 20, ROW_Y(0) + 50],
              [5.4, STEP_PLUS_X, ROW_Y(0)],
              [7.0, STEP_PLUS_X, ROW_Y(0)],
              [7.6, STEP_MINUS_X, ROW_Y(1)],
              [8.6, STEP_MINUS_X, ROW_Y(1)],
              [9.4, 260, ROW_Y(1) + 120],
            ]}
            taps={[2.8, ...PLUS_TAPS, ...MINUS_TAPS]}
            end={9.6}
          />
        )}
      </Phone>
    </Camera>
  );
};

// ---------------------------------------------------------------- 4 the score, on the spot

const CONFUSED: Vitals = { ...RECORDED, consciousness: "C" };

/** Four risk bands popping in over a dark backdrop. */
const RiskHero = ({ s, from, to }: { s: number; from: number; to: number }) => {
  const show = k(s, from, from + 0.3) * (1 - k(s, to - 0.3, to));
  const bands = ["low", "low-medium", "medium", "high"] as const;
  return (
    <AbsoluteFill style={{ backgroundColor: "#EEF5F8F2", opacity: show, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, translate: "0 -20px" }}>
        {bands.map((b, i) => {
          const at = from + 0.35 + i * 0.32;
          const p = k(s, at, at + 0.25, soft);
          const last = i === bands.length - 1;
          const r = RISK[b];
          return (
            <div
              key={b}
              style={{
                padding: last ? "18px 44px" : "12px 32px",
                borderRadius: 12,
                backgroundColor: r.bg,
                color: r.fg,
                fontFamily: F.title,
                fontSize: last ? 76 : 50,
                opacity: p,
                scale: String(0.7 + 0.3 * p),
                boxShadow: last ? `0 10px ${50 * p}px ${C.error}40` : "0 6px 20px #1D27331A",
              }}
            >
              {ACTION[b]}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const ScoreBeat = () => {
  const { s } = useClock();
  const vitals = s < 1.4 ? RECORDED : s < 3.6 ? CONFUSED : DETERIORATING;
  const counting = s >= 3.6 && s < 4.4;
  const shown = counting ? Math.round(interpolate(s, [3.6, 4.4], [news2(CONFUSED).total, news2(DETERIORATING).total], clamp)) : undefined;
  const scroll = interpolate(s, [0.6, 1.1, 2.7, 3.2, 8.7, 9.2], [VITALS_SCROLL, ALERT_SCROLL, ALERT_SCROLL, PRESET_SCROLL, PRESET_SCROLL, SAVE_SCROLL], { ...clamp, easing: ease });
  return (
    <>
      <Camera
        keys={[
          home(0),
          home(0.6),
          aim(1.1, 1.3, 195, 330),
          aim(2.8, 1.3, 195, 330),
          aim(3.3, 1.5, 195, 260),
          aim(6.2, 1.5, 195, 260),
          home(6.4),
          home(8.7),
          aim(9.2, 1.5, 195, SAVE_Y + 10),
          aim(10.15, 1.5, 195, SAVE_Y + 10),
          aim(10.9, 1.45, 195, 600),
          aim(11.4, 1.45, 195, 600),
          home(11.9),
        ]}
      >
        <Phone>
          <Transition
            p={swap(s, 10.15, 10.7)}
            kind="pop"
            from={<VisitFormScreen patient={RUTH} v={vitals} shown={shown} bump={bump(s, 4.4)} scroll={scroll} pressed={held(s, [3.6]) ? "Deteriorating" : held(s, [10.0]) ? "save" : undefined} />}
            to={<WorkerHome name={ADA.name} nearby={2} clinic="enrolled" enrolled={1} sent={[{ v: RUTH_VISIT_PENDING, delivered: 0 }]} scroll={220} />}
          />
          {s < 10.3 && (
            <Touch
              path={[
                [0.9, 240, 560],
                [1.4, CONFUSION[0], CONFUSION[1]],
                [3.1, 300, 560],
                [3.6, DETERIORATING_BTN[0], DETERIORATING_BTN[1]],
                [4.2, 300, 600],
                [9.3, 230, SAVE_Y + 60],
                [10.0, 195, SAVE_Y],
              ]}
              taps={[1.4, 3.6, 10.0]}
              end={10.25}
            />
          )}
        </Phone>
      </Camera>
      <RiskHero s={s} from={6.4} to={8.6} />
    </>
  );
};

const RUTH_VISIT_PENDING: VisitView = { ...RUTH_VISIT, ehr: "pending" };

// ---------------------------------------------------------------- 5 carried by the next phone

/** Bluetooth reach around a phone: a faint dashed circle. */
const Reach = ({ at: [x, y], r, show }: { at: Place; r: number; show: number }) => (
  <div
    style={{
      position: "absolute",
      left: 960 + x - r,
      top: 540 + y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      border: "2px dashed #6E1F3038",
      background: "radial-gradient(circle, #6E1F300C 0%, #6E1F3005 60%, #6E1F3000 72%)",
      opacity: show,
      scale: String(0.85 + 0.15 * show),
    }}
  />
);

/** The sealed record (or the receipt) travelling on an arc between two frame points. */
const Packet = ({ s, from, to, a, b, small }: { s: number; from: number; to: number; a: [number, number]; b: [number, number]; small?: boolean }) => {
  if (s < from || s > to + 0.1) return null;
  const t = k(s, from, to);
  const x = a[0] + (b[0] - a[0]) * t;
  const y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 140;
  const size = small ? 40 : 56;
  return (
    <div
      style={{
        position: "absolute",
        left: 960 + x - size / 2,
        top: 540 + y - size / 2,
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: C.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 8px 24px ${C.accent}55`,
        opacity: interpolate(t, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
      }}
    >
      <Icon icon={small ? Waypoints : Lock} color="#FFFFFF" size={small ? 18 : 24} />
    </div>
  );
};

const ADA_CARD_SCROLL = 220;
const ADA_PILL_Y = 405; // "On this phone, finding a route" with the list at ADA_CARD_SCROLL
const BEN_SCROLL = 540;
const BEN_CARD_Y = 270;
const CLINIC_LIST_SCROLL = 150;
const CARRIED: [string, string, string][] = [[ADA.name, "Riverside Clinic", "10:42"]];

const clinicList = (extra: Received[] = []) => sickestFirst([...EARLIER, ...extra.map((r) => r.v)]).map((v) => extra.find((r) => r.v === v) ?? { v });

export const CarryBeat = () => {
  const { s } = useClock();
  const ada = lerp(T_LEFT, [-OFF, TY, TRIO], k(s, 15.0, 15.6, easeIn));
  const clinic = lerp(lerp([OFF, TY, TRIO], T_RIGHT, k(s, 0.7, 1.3, soft)), CENTRE, k(s, 15.0, 15.8));
  const ben = lerp(lerp([0, 1000, TRIO], T_MID, k(s, 2.2, 2.8, soft)), [0, 1100, TRIO], k(s, 15.0, 15.5, easeIn));
  const reach = k(s, 1.0, 1.5) * (1 - k(s, 14.8, 15.2));
  const delivered = s >= 10.6 ? 1 + (s - 10.6) : 0;
  const centre = (p: Place, sy: number): [number, number] => [p[0], p[1] + (sy - 422) * p[2]];
  return (
    <Camera
      keys={[
        home(0),
        home(4.4),
        aimOn(4.9, 1.9, T_MID, 195, BEN_CARD_Y),
        aimOn(6.9, 1.9, T_MID, 195, BEN_CARD_Y),
        home(7.3),
        home(10.8),
        aimOn(11.3, 1.9, T_LEFT, 195, ADA_PILL_Y),
        aimOn(14.4, 1.9, T_LEFT, 195, ADA_PILL_Y),
        home(14.9),
      ]}
    >
      <Reach at={T_LEFT} r={430} show={reach} />
      <Reach at={T_RIGHT} r={430} show={reach} />
      <Reach at={T_MID} r={640} show={reach * k(s, 2.4, 2.9)} />
      <Placed at={ada}>
        <WorkerHome name={ADA.name} nearby={1} clinic="enrolled" enrolled={1} sent={[{ v: RUTH_VISIT_PENDING, delivered }]} scroll={ADA_CARD_SCROLL} />
      </Placed>
      <Placed at={ben}>
        <WorkerHome name={BEN.name} nearby={2} clinic="enrolled" enrolled={1} carried={s >= 4.2 ? CARRIED : []} scroll={BEN_SCROLL} />
      </Placed>
      <Placed at={clinic}>
        <ClinicScreen nearby={1} workers={[ADA.name, BEN.name]} received={clinicList([{ v: RUTH_VISIT_PENDING, show: k(s, 8.0, 8.45, out) }])} scroll={CLINIC_LIST_SCROLL} />
      </Placed>
      <Packet s={s} from={3.6} to={4.2} a={centre(T_LEFT, 600)} b={centre(T_MID, BEN_CARD_Y)} />
      <Packet s={s} from={7.4} to={8.0} a={centre(T_MID, BEN_CARD_Y)} b={centre(T_RIGHT, 300)} />
      <Packet s={s} from={9.6} to={10.1} a={centre(T_RIGHT, 300)} b={centre(T_MID, BEN_CARD_Y)} small />
      <Packet s={s} from={10.1} to={10.6} a={centre(T_MID, BEN_CARD_Y)} b={centre(T_LEFT, ADA_PILL_Y)} small />
    </Camera>
  );
};

// ---------------------------------------------------------------- 6 sickest first

const RUTH_CARD_Y = 350; // Ruth's vitals grid with the list at CLINIC_LIST_SCROLL

export const SickestBeat = () => {
  const { s } = useClock();
  const scroll = interpolate(s, [7.4, 7.9], [CLINIC_LIST_SCROLL, 0], { ...clamp, easing: ease });
  const received = clinicList([{ v: RUTH_VISIT_PENDING }, { v: JOSEPH_VISIT, show: k(s, 1.8, 2.3, out) }]);
  return (
    <Camera
      keys={[
        home(0),
        home(0.6),
        aim(1.1, 1.25, 195, 520),
        aim(4.3, 1.25, 195, 520),
        aim(4.8, 1.9, 195, RUTH_CARD_Y),
        aim(7.3, 1.9, 195, RUTH_CARD_Y),
        aim(7.9, 1.6, 195, 230),
        aim(10.3, 1.6, 195, 230),
        home(10.6),
      ]}
    >
      <Phone>
        <ClinicScreen nearby={2} workers={[ADA.name, BEN.name]} received={received} scroll={scroll} />
      </Phone>
    </Camera>
  );
};

// ---------------------------------------------------------------- 7 into the real EHR

const EHR_SCROLL = 1500;
const FLIP_AT = (i: number) => 3.9 + i * 0.15;

const OBSERVATIONS = [
  "Respiratory rate · 27 /min",
  "Oxygen saturation · 90 %",
  "Systolic blood pressure · 96 mmHg",
  "Heart rate · 124 /min",
  "Body temperature · 39.4 °C",
  "On supplemental oxygen · no",
  "Level of consciousness (ACVPU) · C",
  "NEWS2 total score · 15",
];

/** Ruth's visit as the EHR holds it: a Patient, an Encounter and eight Observations. */
const EhrHero = ({ s, from, to }: { s: number; from: number; to: number }) => {
  const show = k(s, from, from + 0.3) * (1 - k(s, to - 0.3, to));
  const item = (i: number) => k(s, from + 0.5 + i * 0.12, from + 0.7 + i * 0.12, out);
  const line = { fontFamily: F.body, fontSize: 25, color: C.ink };
  return (
    <AbsoluteFill style={{ backgroundColor: "#EEF5F8F2", opacity: show, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1060, translate: "0 -20px", backgroundColor: C.surface, borderRadius: 16, padding: "32px 40px", boxShadow: "0 30px 90px #1D273333", scale: String(0.94 + 0.06 * show) }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontFamily: F.title, fontSize: 54, color: C.ink }}>{RUTH.name}</span>
          <span style={{ fontFamily: F.medium, fontSize: 22, color: C.muted }}>FHIR R4 · Medplum</span>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 24, color: C.muted, marginTop: 4 }}>Encounter · home health · Ada (community health worker)</div>
        <div style={{ height: 1, backgroundColor: C.line, margin: "22px 0" }} />
        <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
          {["Patient", "Encounter", "8 Observations"].map((t, i) => (
            <span key={t} style={{ fontFamily: F.strong, fontSize: 24, color: C.accent, backgroundColor: C.accentSoft, borderRadius: 8, padding: "8px 16px", opacity: item(i), translate: `0 ${(1 - item(i)) * 14}px` }}>
              {t}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 30 }}>
          {OBSERVATIONS.map((o, i) => (
            <span key={o} style={{ ...line, opacity: item(i + 3), translate: `0 ${(1 - item(i + 3)) * 12}px` }}>
              {o}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const EhrBeat = () => {
  const { s } = useClock();
  const clinic = LEFT;
  const ada: Place = [interpolate(s, [0.6, 1.25], [OFF, SPLIT], { ...clamp, easing: soft }), Y, P];
  const synced = s >= 2.6;
  const list = clinicList([{ v: RUTH_VISIT_PENDING }, { v: JOSEPH_VISIT }]).map((r, i) => ({ v: { ...r.v, ehr: synced && s >= FLIP_AT(i) ? ("added" as const) : ("pending" as const) } }));
  const scroll = interpolate(s, [0.6, 1.3, 3.1, 3.8], [0, EHR_SCROLL, EHR_SCROLL, CLINIC_LIST_SCROLL], { ...clamp, easing: ease });
  const adaEhr = s >= 9.4 ? "already" : "pending";
  return (
    <>
      <Camera
        keys={[
          home(0),
          home(1.3),
          aimOn(1.8, 1.6, LEFT, 195, 500),
          aimOn(3.1, 1.6, LEFT, 195, 500),
          aimOn(3.8, 1.3, LEFT, 195, 420),
          aimOn(5.2, 1.3, LEFT, 195, 420),
          home(5.4),
          home(8.6),
          aimOn(9.1, 1.8, RIGHT, 195, ADA_PILL_Y),
          aimOn(11.3, 1.8, RIGHT, 195, ADA_PILL_Y),
          home(11.8),
        ]}
      >
        <Placed at={clinic}>
          <ClinicScreen nearby={1} workers={[ADA.name, BEN.name]} received={list} note={synced ? "Medplum: 5 added" : undefined} synced={synced} scroll={scroll} wifi={k(s, 1.6, 1.9, out)} />
        </Placed>
        <Placed at={ada}>
          <WorkerHome name={ADA.name} nearby={1} clinic="enrolled" enrolled={1} sent={[{ v: { ...RUTH_VISIT, ehr: adaEhr }, delivered: 2 }]} scroll={ADA_CARD_SCROLL} wifi={k(s, 9.0, 9.3, out)} />
        </Placed>
      </Camera>
      <EhrHero s={s} from={5.4} to={8.4} />
    </>
  );
};

/** The two phones at the end of the EHR beat. */
const EhrEnd = () => (
  <>
    <ClinicScreen nearby={1} workers={[ADA.name, BEN.name]} received={clinicList([{ v: RUTH_VISIT }, { v: JOSEPH_VISIT }]).map((r) => ({ v: { ...r.v, ehr: "added" as const } }))} note="Medplum: 5 added" synced scroll={CLINIC_LIST_SCROLL} wifi={1} />
  </>
);

// ---------------------------------------------------------------- exit and close

export const Exit = () => {
  const { s } = useClock();
  const drop = interpolate(s, [0.1, 1.1], [0, 260], { ...clamp, easing: easeIn });
  const fade = interpolate(s, [0.1, 1.1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Placed at={[LEFT[0], LEFT[1] + drop, P]}>
        <EhrEnd />
      </Placed>
      <Placed at={[RIGHT[0], RIGHT[1] + drop, P]}>
        <WorkerHome name={ADA.name} nearby={1} clinic="enrolled" enrolled={1} sent={[{ v: { ...RUTH_VISIT, ehr: "already" }, delivered: 2 }]} scroll={ADA_CARD_SCROLL} wifi={1} />
      </Placed>
    </AbsoluteFill>
  );
};

/** The app's launcher icon: a maroon cross on a soft disc. */
const AppMark = ({ size }: { size: number }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px #6E1F301F" }}>
    <div style={{ position: "relative", width: size * 0.46, height: size * 0.46 }}>
      <div style={{ position: "absolute", left: "33%", width: "34%", height: "100%", borderRadius: size * 0.05, backgroundColor: C.accent }} />
      <div style={{ position: "absolute", top: "33%", height: "34%", width: "100%", borderRadius: size * 0.05, backgroundColor: C.accent }} />
    </div>
  </div>
);

/**
 * The closing line, one phrase at a time, then the WeCare mark and what it runs on.
 * Everything fades back into the wallpaper with the music.
 */
export const Close = () => {
  const { s } = useClock();
  const line = 1 - k(s, 2.9, 3.4);
  const mark = k(s, 3.4, 4.3, soft);
  return (
    <AbsoluteFill style={{ opacity: 1 - k(s, 6.0, 6.9), alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", display: "flex", gap: 24, opacity: line, translate: `0 ${-60 - (1 - line) * 20}px` }}>
        <Fade s={s} at={0.3} style={{ ...serif, fontSize: 88 }}>
          Every visit
        </Fade>
        <Fade s={s} at={0.95} style={{ ...serif, fontSize: 88 }}>
          finds its way
        </Fade>
        <Fade s={s} at={1.6} style={{ ...serif, fontSize: 88, color: C.accent }}>
          to the clinic.
        </Fade>
      </div>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: 26, translate: "0 -70px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: mark, translate: `0 ${(1 - mark) * 16}px` }}>
          <AppMark size={128} />
          <span style={{ ...serif, fontSize: 132 }}>WeCare</span>
        </div>
        <Fade s={s} at={4.4} style={{ fontFamily: F.body, fontSize: 36, color: C.muted }}>
          Built on Offline Protocol
        </Fade>
      </div>
    </AbsoluteFill>
  );
};
