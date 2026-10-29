import { AbsoluteFill, Sequence, Track, useVideoConfig } from "remotion";
import { CarryBeat, Close, ColdOpen, EhrBeat, EnrollBeat, Exit, Featured, INTRO_EXTRA, PhoneEnter, RecordBeat, ScoreBeat, SetupBeat, SickestBeat } from "./scenes";
import { Drift, Wallpaper } from "./type";

// Beat lengths in seconds. Each feature is its own timeline plus the side-by-side intro.
const X = INTRO_EXTRA;
const LENGTHS = {
  enter: 3,
  setup: 11 + X,
  enroll: 14 + X,
  record: 13 + X,
  score: 12 + X,
  carry: 16 + X,
  sickest: 11 + X,
  ehr: 15 + X,
  exit: 1.2,
  close: 7,
};
const ORDER = Object.keys(LENGTHS) as (keyof typeof LENGTHS)[];
/** Start of each beat: the cold open runs from 0 to 4 s, then the beats follow one another. */
const START = Object.fromEntries(ORDER.map((b, i) => [b, 4 + ORDER.slice(0, i).reduce((t, x) => t + LENGTHS[x], 0)])) as Record<keyof typeof LENGTHS, number>;
export const TOTAL = START.close + LENGTHS.close;

// The beats' own scene objects: the main phone's place when each beat's timeline starts.
const LEFT_DUO = [-250, 0, 0.95] as [number, number, number];
const RIGHT_DUO = [250, 0, 0.95] as [number, number, number];
const TRIO_LEFT = [-560, 0, 0.75] as [number, number, number];

export const Launch = () => {
  const { fps } = useVideoConfig();
  const at = (b: keyof typeof LENGTHS) => ({ from: Math.round(START[b] * fps), durationInFrames: Math.round(LENGTHS[b] * fps) });
  return (
    <AbsoluteFill>
      <Wallpaper />
      <Drift>
        <Track name="Scenes">
          <Sequence name="Phone enters" {...at("enter")}>
            <PhoneEnter />
          </Sequence>
          <Sequence name="1 · Set up" {...at("setup")}>
            <Featured side="L" title="Set up a phone" body="One app, two jobs: the health worker's phone or the clinic's hub. No account and no sign-up, and the mesh starts with no internet.">
              <SetupBeat />
            </Featured>
          </Sequence>
          <Sequence name="2 · Enroll" {...at("enroll")}>
            <Featured side="R" at={RIGHT_DUO} title="Enroll with a scan" body="The clinic shows a code that carries its key, not a password. Someone at the clinic taps Enroll, and Ada's visits are sealed for that clinic alone.">
              <EnrollBeat />
            </Featured>
          </Sequence>
          <Sequence name="3 · Record" {...at("record")}>
            <Featured side="L" title="Record the visit" body="Pick who you're with, then step each vital in as you measure it. No typing on a doorstep, and every reading shows what it adds to the score.">
              <RecordBeat />
            </Featured>
          </Sequence>
          <Sequence name="4 · Score" {...at("score")}>
            <Featured side="R" title="The score, on the spot" body="NEWS2, the early-warning score used across the NHS, worked out on the phone. One clear next step, from routine follow-up to emergency transfer.">
              <ScoreBeat />
            </Featured>
          </Sequence>
          <Sequence name="5 · Carried" {...at("carry")}>
            <Featured side="L" at={TRIO_LEFT} title="Carried by the next phone" body="No signal at Ruth's door, so the visit waits on Ada's phone. The next WeCare phone carries it on, sealed: it can't read a word. The receipt comes back the same way.">
              <CarryBeat />
            </Featured>
          </Sequence>
          <Sequence name="6 · Sickest first" {...at("sickest")}>
            <Featured side="R" title="Sickest first" body="Every visit lands on the clinic's list by risk, not by time. The clinic re-scores each one itself, and only takes visits from phones it enrolled.">
              <SickestBeat />
            </Featured>
          </Sequence>
          <Sequence name="7 · EHR" {...at("ehr")}>
            <Featured side="L" at={LEFT_DUO} title="Into the real EHR" body="Once the clinic is online, each visit goes to Medplum over FHIR: a patient, an encounter and eight observations. Ada's copy arrives too, and the EHR keeps one.">
              <EhrBeat />
            </Featured>
          </Sequence>
          <Sequence name="Exit" {...at("exit")}>
            <Exit />
          </Sequence>
        </Track>
      </Drift>
      <Track name="Type">
        <Sequence name="Cold open" durationInFrames={4 * fps}>
          <ColdOpen />
        </Sequence>
        <Sequence name="Close" {...at("close")}>
          <Close />
        </Sequence>
      </Track>
    </AbsoluteFill>
  );
};
