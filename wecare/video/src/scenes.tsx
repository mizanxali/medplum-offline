import { Lock, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ACTION, ADA, BEN, DETERIORATING, EARLIER, JOSEPH_VISIT, news2, NORMAL, RUTH, RUTH_VISIT, sickestFirst, type VisitView, type Vitals } from "./data";
import { ClinicScreen, ScannerScreen, VisitFormScreen, WelcomeScreen, WorkerHome, type Received } from "./screens";
import { C, F, RISK } from "./theme";
import { Words } from "./type";
import { Icon, Keyboard, Phone, SFX, Sfx, TouchDot } from "./ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.55, 0, 1, 0.45);
const overshoot = Easing.bezier(0.34, 1.35, 0.64, 1);

const useClock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, s: frame / fps };
};

/** 0 → 1 between `a` and `b` seconds. */
const k = (s: number, a: number, b: number, easing = ease) => interpolate(s, [a, b], [0, 1], { ...clamp, easing });

/** The phone dims while the title lands, then undims as it moves into the band. */
const dim = (s: number) => interpolate(s, [0, 0.12, 0.6, 1.0], [0, 0.6, 0.6, 0], clamp);

// ---------------------------------------------------------------- camera

type Key = [sec: number, scale: number, tx: number, ty: number];
/** Frame y (relative to centre) where the action sits: just above the caption band. */
const ACTION_Y = -110;
/** Camera that lands point (x, y), relative to the frame centre at scale 1, on the action spot. */
const aimAt = (sec: number, scale: number, x: number, y: number): Key => [sec, scale, -scale * x, ACTION_Y - scale * y];
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
const KeyClicks = ({ text, start, per }: { text: string; start: number; per: number }) => {
  const { fps } = useClock();
  return (
    <>
      {[...text].map((_, i) => (
        <Sfx key={i} at={(start + i * per) * fps} src={SFX.tap} volume={0.12 + ((i * 7) % 5) * 0.03} />
      ))}
    </>
  );
};

const shakeAt = (s: number, at: number, len: number, amp: number) => (s >= at && s < at + len ? amp * Math.sin((s - at) * 70) * (1 - (s - at) / len) : 0);
const bump = (s: number, at: number) => interpolate(s - at, [0, 0.1, 0.35], [0, 1, 0], clamp);
/** How many of `taps` (seconds) have happened by `s`. */
const count = (s: number, taps: number[]) => taps.filter((t) => s >= t).length;
/** The control under a tap at `t` reads as held for 0.15 s. */
const held = (s: number, taps: number[]) => taps.some((t) => s >= t - 0.02 && s < t + 0.15);

// ---------------------------------------------------------------- multi-phone layouts

type Place = [x: number, y: number, scale: number];

const Placed = ({ at: [x, y, scale], dimmed = 0, children }: { at: Place; dimmed?: number; children: ReactNode }) => (
  <Phone dim={dimmed} style={{ translate: `${x}px ${y}px`, scale: String(scale) }}>
    {children}
  </Phone>
);

const lerp = (a: Place, b: Place, t: number): Place => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const CENTRE: Place = [0, 0, 1];
const P = 0.9; // phone scale in a split
const Y = -68; // split phones ride up above the band
const SPLIT = 250;
const LEFT: Place = [-SPLIT, Y, P];
const RIGHT: Place = [SPLIT, Y, P];
const OFF_RIGHT: Place = [1300, Y, P];
const TRIO = 0.72;
const TY = -50;
const T_LEFT: Place = [-560, TY, TRIO];
const T_MID: Place = [0, TY, TRIO];
const T_RIGHT: Place = [560, TY, TRIO];

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

export const ColdOpen = () => {
  const { s } = useClock();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", opacity: 1 - k(s, 3.0, 3.5) }}>
      <Words
        words={[
          ["the", 0.3],
          ["last", 0.7],
          ["mile", 1.1],
          ["has", 1.6],
          ["no", 2.0],
          ["signal", 2.4],
        ]}
        exit={3.0}
        size={128}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 0:04 phone enters

const EARLIER_RECEIVED: Received[] = EARLIER.map((v) => ({ v }));

export const PhoneEnter = () => {
  const { s } = useClock();
  return (
    <Camera keys={[[0, 0.94, 0, 0], [3, 1, 0, 0]]}>
      <Phone style={{ translate: `0 ${interpolate(s, [0, 0.9], [1100, 0], { ...clamp, easing: overshoot })}px` }}>
        <ClinicScreen nearby={2} workers={[ADA.name, BEN.name]} received={EARLIER_RECEIVED} scroll={150} />
      </Phone>
      <Sfx at={0} src={SFX.whoosh} volume={0.3} />
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
  const cut = s >= 7.2;
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
        aim(7.19, 1.6, 195, START_Y - WELCOME_SCROLL - 40),
        aim(7.2, 1.9, 150, 125),
        aim(9.0, 1.9, 150, 125),
        aim(10.0, 1.5, 195, 230),
        home(10.5),
      ]}
    >
      <Phone dim={dim(s)}>
        {cut ? (
          <WorkerHome name={ADA.name} nearby={2} clinic="none" />
        ) : (
          <>
            <WelcomeScreen role={role} name={name.value} caret={s >= 4.2 && s < 6.2} pressed={held(s, [6.8])} scroll={scroll} />
            <Keyboard show={kb} pressed={name.pressed} />
          </>
        )}
        {!cut && (
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
      <KeyClicks text="Ada" start={NAME_START} per={NAME_PER} />
    </Camera>
  );
};

// ---------------------------------------------------------------- 2 enroll with a scan

export const EnrollBeat = () => {
  const { s, fps } = useClock();
  const into = k(s, 0.5, 1.1);
  const back = k(s, 13.3, 13.9);
  const ada = lerp(lerp(CENTRE, LEFT, into), CENTRE, back);
  const clinic: Place = [interpolate(s, [0.6, 1.25], [OFF_RIGHT[0], SPLIT], { ...clamp, easing: overshoot }) + interpolate(s, [13.3, 13.9], [0, 1100], { ...clamp, easing: easeIn }), Y, P];
  const scanning = s >= 1.9 && s < 3.15;
  const adaState = s < 3.15 ? "none" : s < 7.1 ? "waiting" : "enrolled";
  const request = k(s, 4.6, 5.0, out) * (1 - k(s, 6.95, 7.3));
  return (
    <Camera
      keys={[
        home(0),
        home(4.3),
        aimOn(4.9, 1.5, RIGHT, 195, 260),
        aimOn(7.0, 1.5, RIGHT, 195, 260),
        aimOn(7.6, 1.4, LEFT, 195, 230),
        aimOn(9.0, 1.7, LEFT, 195, 215),
        aimOn(12.4, 1.7, LEFT, 195, 215),
        home(13.0),
      ]}
    >
      <Placed at={ada} dimmed={dim(s)}>
        {scanning ? <ScannerScreen qr={k(s, 2.0, 2.8, out)} flash={interpolate(s, [2.85, 2.95, 3.15], [0, 1, 0], clamp)} /> : <WorkerHome name={ADA.name} nearby={2} clinic={adaState} enrolled={k(s, 7.1, 7.45, out)} />}
        <Touch
          path={[
            [1.1, 230, 420],
            [1.6, 195, SCAN_BTN_Y],
          ]}
          taps={[1.6]}
          end={1.9}
        />
      </Placed>
      <Placed at={clinic} dimmed={dim(s)}>
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
      <Sfx at={1.65 * fps} src={SFX.whoosh} volume={0.3} />
      <Sfx at={3.0 * fps} src={SFX.whoosh} volume={0.25} />
      <Sfx at={4.6 * fps} src={SFX.chime} volume={0.35} />
      <Sfx at={6.85 * fps} src={SFX.toggle} volume={0.4} />
      <Sfx at={7.1 * fps} src={SFX.toggle} volume={0.4} />
      <Sfx at={13.3 * fps} src={SFX.whoosh} volume={0.25} />
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
  const form = s >= 1.9;
  const scroll = VITALS_SCROLL * k(s, 4.4, 4.9);
  const pressed = held(s, PLUS_TAPS) ? "respRate+" : held(s, MINUS_TAPS) ? "spo2-" : undefined;
  return (
    <Camera
      keys={[
        home(0),
        home(0.6),
        aim(1.1, 1.5, 195, NEW_VISIT_Y),
        aim(1.89, 1.5, 195, NEW_VISIT_Y),
        aim(1.9, 1.4, 195, 380),
        aim(4.0, 1.4, 195, 380),
        aim(4.9, 1.55, 220, ROW_Y(0) + 40),
        aim(7.4, 1.55, 220, ROW_Y(0) + 40),
        aim(8.0, 1.55, 220, ROW_Y(1) + 20),
        aim(10.0, 1.4, 200, 300),
        aim(12.4, 1.4, 200, 300),
        home(12.9),
      ]}
    >
      <Phone dim={dim(s)}>
        {form ? (
          <VisitFormScreen patient={s >= 2.8 ? RUTH : undefined} v={recorded(s)} scroll={scroll} pressed={pressed} />
        ) : (
          <WorkerHome name={ADA.name} nearby={2} clinic="enrolled" enrolled={1} />
        )}
        {!form && (
          <Touch
            path={[
              [1.1, 230, 420],
              [1.6, 195, NEW_VISIT_Y],
            ]}
            taps={[1.6]}
            end={1.85}
          />
        )}
        {form && (
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
  const { fps } = useClock();
  const show = k(s, from, from + 0.3) * (1 - k(s, to - 0.3, to));
  const bands = ["low", "low-medium", "medium", "high"] as const;
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070AE6", opacity: show, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, translate: "0 -90px" }}>
        {bands.map((b, i) => {
          const at = from + 0.35 + i * 0.32;
          const p = k(s, at, at + 0.25, overshoot);
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
                boxShadow: last ? `0 0 ${80 * p}px ${C.error}AA` : undefined,
              }}
            >
              {ACTION[b]}
            </div>
          );
        })}
      </div>
      {bands.map((b, i) => (
        <Sfx key={b} at={(from + 0.35 + i * 0.32) * fps} src={SFX.tap} volume={0.35} />
      ))}
    </AbsoluteFill>
  );
};

export const ScoreBeat = () => {
  const { s, fps } = useClock();
  const vitals = s < 1.4 ? RECORDED : s < 3.6 ? CONFUSED : DETERIORATING;
  const counting = s >= 3.6 && s < 4.4;
  const shown = counting ? Math.round(interpolate(s, [3.6, 4.4], [news2(CONFUSED).total, news2(DETERIORATING).total], clamp)) : undefined;
  const scroll = interpolate(s, [0.6, 1.1, 2.7, 3.2, 8.7, 9.2], [VITALS_SCROLL, ALERT_SCROLL, ALERT_SCROLL, PRESET_SCROLL, PRESET_SCROLL, SAVE_SCROLL], { ...clamp, easing: ease });
  const cut = s >= 10.3;
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
          aim(10.29, 1.5, 195, SAVE_Y + 10),
          aim(10.3, 1.45, 195, 600),
          aim(11.4, 1.45, 195, 600),
          home(11.9),
        ]}
        shake={shakeAt(s, 4.4, 0.35, 6)}
      >
        <Phone dim={dim(s)}>
          {cut ? (
            <WorkerHome name={ADA.name} nearby={2} clinic="enrolled" enrolled={1} sent={[{ v: RUTH_VISIT_PENDING, delivered: 0 }]} scroll={220} />
          ) : (
            <VisitFormScreen patient={RUTH} v={vitals} shown={shown} bump={bump(s, 4.4)} scroll={scroll} pressed={held(s, [3.6]) ? "Deteriorating" : held(s, [10.0]) ? "save" : undefined} />
          )}
          {!cut && (
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
        <Sfx at={10.3 * fps} src={SFX.whoosh} volume={0.2} />
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
      border: "2px dashed #FFFFFF40",
      background: "radial-gradient(circle, #FFFFFF10 0%, #FFFFFF04 60%, #FFFFFF00 72%)",
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
        boxShadow: `0 0 30px ${C.accent}`,
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
  const { s, fps } = useClock();
  const ada = lerp(lerp(CENTRE, T_LEFT, k(s, 0.4, 1.0)), [-1300, TY, TRIO], k(s, 15.0, 15.6, easeIn));
  const clinic = lerp(lerp([1300, TY, TRIO], T_RIGHT, k(s, 0.5, 1.1, overshoot)), CENTRE, k(s, 15.0, 15.8));
  const ben = lerp(lerp([0, 900, TRIO], T_MID, k(s, 2.2, 2.8, overshoot)), [0, 1000, TRIO], k(s, 15.0, 15.5, easeIn));
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
      <Placed at={ada} dimmed={dim(s)}>
        <WorkerHome name={ADA.name} nearby={1} clinic="enrolled" enrolled={1} sent={[{ v: RUTH_VISIT_PENDING, delivered }]} scroll={ADA_CARD_SCROLL} />
      </Placed>
      <Placed at={ben} dimmed={dim(s)}>
        <WorkerHome name={BEN.name} nearby={2} clinic="enrolled" enrolled={1} carried={s >= 4.2 ? CARRIED : []} scroll={BEN_SCROLL} />
      </Placed>
      <Placed at={clinic} dimmed={dim(s)}>
        <ClinicScreen nearby={1} workers={[ADA.name, BEN.name]} received={clinicList([{ v: RUTH_VISIT_PENDING, show: k(s, 8.0, 8.45, out) }])} scroll={CLINIC_LIST_SCROLL} />
      </Placed>
      <Packet s={s} from={3.6} to={4.2} a={centre(T_LEFT, 600)} b={centre(T_MID, BEN_CARD_Y)} />
      <Packet s={s} from={7.4} to={8.0} a={centre(T_MID, BEN_CARD_Y)} b={centre(T_RIGHT, 300)} />
      <Packet s={s} from={9.6} to={10.1} a={centre(T_RIGHT, 300)} b={centre(T_MID, BEN_CARD_Y)} small />
      <Packet s={s} from={10.1} to={10.6} a={centre(T_MID, BEN_CARD_Y)} b={centre(T_LEFT, ADA_PILL_Y)} small />
      <Sfx at={2.2 * fps} src={SFX.whoosh} volume={0.25} />
      <Sfx at={3.6 * fps} src={SFX.whoosh} volume={0.4} />
      <Sfx at={7.4 * fps} src={SFX.whoosh} volume={0.4} />
      <Sfx at={8.0 * fps} src={SFX.chime} volume={0.35} />
      <Sfx at={9.6 * fps} src={SFX.whoosh} volume={0.2} />
      <Sfx at={10.6 * fps} src={SFX.toggle} volume={0.4} />
      <Sfx at={15.0 * fps} src={SFX.whoosh} volume={0.25} />
    </Camera>
  );
};

// ---------------------------------------------------------------- 6 sickest first

const RUTH_CARD_Y = 350; // Ruth's vitals grid with the list at CLINIC_LIST_SCROLL

export const SickestBeat = () => {
  const { s, fps } = useClock();
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
      <Phone dim={dim(s)}>
        <ClinicScreen nearby={2} workers={[ADA.name, BEN.name]} received={received} scroll={scroll} />
      </Phone>
      <Sfx at={1.8 * fps} src={SFX.chime} volume={0.3} />
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
    <AbsoluteFill style={{ backgroundColor: "#05070AE6", opacity: show, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1060, translate: "0 -100px", backgroundColor: C.surface, borderRadius: 16, padding: "32px 40px", boxShadow: "0 30px 120px #000", scale: String(0.94 + 0.06 * show) }}>
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
  const { s, fps } = useClock();
  const into = k(s, 0.4, 1.0);
  const clinic = lerp(CENTRE, LEFT, into);
  const ada: Place = [interpolate(s, [0.5, 1.15], [OFF_RIGHT[0], SPLIT], { ...clamp, easing: overshoot }), Y, P];
  const synced = s >= 2.6;
  const list = clinicList([{ v: RUTH_VISIT_PENDING }, { v: JOSEPH_VISIT }]).map((r, i) => ({ v: { ...r.v, ehr: synced && s >= FLIP_AT(i) ? ("added" as const) : ("pending" as const) } }));
  const scroll = interpolate(s, [0.6, 1.3, 3.1, 3.8], [CLINIC_LIST_SCROLL, EHR_SCROLL, EHR_SCROLL, CLINIC_LIST_SCROLL], { ...clamp, easing: ease });
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
        <Placed at={clinic} dimmed={dim(s)}>
          <ClinicScreen nearby={1} workers={[ADA.name, BEN.name]} received={list} note={synced ? "Medplum: 5 added" : undefined} synced={synced} scroll={scroll} wifi={k(s, 1.6, 1.9, out)} />
        </Placed>
        <Placed at={ada} dimmed={dim(s)}>
          <WorkerHome name={ADA.name} nearby={1} clinic="enrolled" enrolled={1} sent={[{ v: { ...RUTH_VISIT, ehr: adaEhr }, delivered: 2 }]} scroll={ADA_CARD_SCROLL} wifi={k(s, 9.0, 9.3, out)} />
        </Placed>
        <Sfx at={1.6 * fps} src={SFX.toggle} volume={0.3} />
        <Sfx at={3.9 * fps} src={SFX.toggle} volume={0.35} />
        <Sfx at={9.0 * fps} src={SFX.toggle} volume={0.3} />
        <Sfx at={9.4 * fps} src={SFX.toggle} volume={0.4} />
      </Camera>
      <EhrHero s={s} from={5.4} to={8.4} />
      <Sfx at={5.4 * fps} src={SFX.whoosh} volume={0.3} />
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
  const drop = interpolate(s, [0.2, 0.8], [0, 1150], { ...clamp, easing: easeIn });
  return (
    <>
      <Placed at={[LEFT[0], LEFT[1] + drop, P]}>
        <EhrEnd />
      </Placed>
      <Placed at={[RIGHT[0], RIGHT[1] + drop, P]}>
        <WorkerHome name={ADA.name} nearby={1} clinic="enrolled" enrolled={1} sent={[{ v: { ...RUTH_VISIT, ehr: "already" }, delivered: 2 }]} scroll={ADA_CARD_SCROLL} wifi={1} />
      </Placed>
      <Sfx at={12} src={SFX.whoosh} volume={0.2} />
    </>
  );
};

const PLACES = ["home visits", "outreach camps", "rural clinics", "disaster response", "refugee camps"];
const PLACE_AT = (i: number) => 0.7 + i * 0.5; // each setting holds 0.5 s in the slot
const COLLAPSE = 3.3; // the cycling slot turns into the full list

/** Text that snaps up from 12 px with a blur, at `at` seconds. */
const Rise = ({ s, at, children, style }: { s: number; at: number; children: ReactNode; style?: React.CSSProperties }) => {
  const r = k(s, at, at + 0.2, out);
  return <span style={{ opacity: r, translate: `0 ${(1 - r) * 12}px`, filter: `blur(${(1 - r) * 10}px)`, whiteSpace: "nowrap", ...style }}>{children}</span>;
};

const big = { fontFamily: F.strong, fontSize: 120, letterSpacing: -4, color: C.text, lineHeight: 1 };

/** "built for" over a slot that cycles through the settings, then "on Offline Protocol". */
export const Close = () => {
  const { s } = useClock();
  return (
    <>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34 }}>
        <Rise s={s} at={0.2} style={big}>
          built for
        </Rise>
        <div style={{ position: "relative", width: 1800, height: 130 }}>
          {PLACES.map((p, i) => {
            const enter = k(s, PLACE_AT(i), PLACE_AT(i) + 0.2, out);
            const leave = i < PLACES.length - 1 ? k(s, PLACE_AT(i + 1), PLACE_AT(i + 1) + 0.15) : k(s, COLLAPSE, COLLAPSE + 0.2);
            return (
              <span
                key={p}
                style={{
                  ...big,
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.grey,
                  opacity: enter * (1 - leave),
                  translate: `0 ${(1 - enter) * 40 - leave * 40}px`,
                  filter: `blur(${(1 - enter) * 10 + leave * 10}px)`,
                }}
              >
                {p}
              </span>
            );
          })}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            {PLACES.map((p, i) => (
              <Rise key={p} s={s} at={COLLAPSE + 0.15 + i * 0.07} style={{ fontFamily: F.medium, fontSize: 44, color: C.grey }}>
                {i ? <span style={{ color: C.dark, marginRight: 16 }}>·</span> : null}
                {p}
              </Rise>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 34 }}>
          <Rise s={s} at={4.1} style={big}>
            on
          </Rise>
          <Rise s={s} at={4.45} style={big}>
            Offline Protocol
          </Rise>
        </div>
      </AbsoluteFill>
      {s >= 6.7 && <AbsoluteFill style={{ backgroundColor: "#000" }} />}
    </>
  );
};
