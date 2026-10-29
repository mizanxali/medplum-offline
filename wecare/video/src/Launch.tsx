import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, Track, useVideoConfig } from "remotion";
import { CarryBeat, Close, ColdOpen, EhrBeat, EnrollBeat, Exit, PhoneEnter, RecordBeat, ScoreBeat, SetupBeat, SickestBeat } from "./scenes";
import { BandText, Caption, Drift, Scrim, Wallpaper } from "./type";

// Beat starts and lengths in seconds; each beat and its caption share them.
const BEATS = {
  enter: [4, 3],
  setup: [7, 11],
  enroll: [18, 14],
  record: [32, 13],
  score: [45, 12],
  carry: [57, 16],
  sickest: [73, 11],
  ehr: [84, 15],
  exit: [99, 1.2],
  close: [100.2, 7],
} as const;

export const Launch = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const at = (b: keyof typeof BEATS) => ({ from: Math.round(BEATS[b][0] * fps), durationInFrames: Math.round(BEATS[b][1] * fps) });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Wallpaper />
      <Drift>
        <Track name="Scenes">
          <Sequence name="Phone enters" {...at("enter")}>
            <PhoneEnter />
          </Sequence>
          <Sequence name="1 · Set up" {...at("setup")}>
            <SetupBeat />
          </Sequence>
          <Sequence name="2 · Enroll" {...at("enroll")}>
            <EnrollBeat />
          </Sequence>
          <Sequence name="3 · Record" {...at("record")}>
            <RecordBeat />
          </Sequence>
          <Sequence name="4 · Score" {...at("score")}>
            <ScoreBeat />
          </Sequence>
          <Sequence name="5 · Carried" {...at("carry")}>
            <CarryBeat />
          </Sequence>
          <Sequence name="6 · Sickest first" {...at("sickest")}>
            <SickestBeat />
          </Sequence>
          <Sequence name="7 · EHR" {...at("ehr")}>
            <EhrBeat />
          </Sequence>
          <Sequence name="Exit" {...at("exit")}>
            <Exit />
          </Sequence>
        </Track>
      </Drift>
      <Scrim />
      <Track name="Captions">
        <Sequence name="WeCare" {...at("enter")}>
          <BandText />
        </Sequence>
        <Sequence name="Set up a phone" {...at("setup")}>
          <Caption
            title="Set up a phone"
            lines={[
              [0.85, "One app, two jobs: a health worker's phone or the clinic's hub."],
              [4.2, "No account and no sign-up. Just a name."],
              [7.2, "The mesh starts straight away. No internet needed."],
            ]}
          />
        </Sequence>
        <Sequence name="Enroll with a scan" {...at("enroll")}>
          <Caption
            title="Enroll with a scan"
            lines={[
              [0.85, "The clinic shows a code. It carries the clinic's key, not a password."],
              [3.0, "The phone checks the code is genuine before it sends a thing."],
              [4.8, "Scanning is not enough to join: someone at the clinic taps Enroll."],
              [7.4, "From now on, Ada's visits are sealed for this clinic alone."],
            ]}
          />
        </Sequence>
        <Sequence name="Record the visit" {...at("record")}>
          <Caption
            title="Record the visit"
            lines={[
              [0.85, "Pick who you're with from the household list."],
              [4.4, "Step each vital in as you measure it. No typing on a doorstep."],
              [7.8, "Every reading shows what it adds to the score."],
            ]}
          />
        </Sequence>
        <Sequence name="The score, on the spot" {...at("score")}>
          <Caption
            title="The score, on the spot"
            lines={[
              [0.85, "NEWS2, the early-warning score used across the NHS, worked out on the phone."],
              [3.6, "It turns the vitals into one clear next step."],
              [6.4, "From routine follow-up to emergency transfer."],
              [8.8, "Saved on the phone first, whether there's signal or not."],
            ]}
          />
        </Sequence>
        <Sequence name="Carried by the next phone" {...at("carry")}>
          <Caption
            title="Carried by the next phone"
            lines={[
              [0.85, "Still no signal at Ruth's door, so the visit waits on Ada's phone."],
              [2.6, "Any WeCare phone that comes within range carries it on."],
              [4.4, "Sealed for the clinic: the phone in the middle can't read a word."],
              [8.0, "It reaches the clinic, hopping phone to phone over Bluetooth."],
              [10.4, "The clinic's receipt comes back the same way. Until then, Ada's phone keeps resending."],
            ]}
          />
        </Sequence>
        <Sequence name="Sickest first" {...at("sickest")}>
          <Caption
            title="Sickest first"
            lines={[
              [0.85, "The clinic sees every visit, sickest first."],
              [2.4, "New arrivals slot in by risk, not by time."],
              [4.8, "The clinic re-scores every visit itself. It never trusts the number sent."],
              [7.8, "And it only takes visits from phones it enrolled."],
            ]}
          />
        </Sequence>
        <Sequence name="Into the real EHR" {...at("ehr")}>
          <Caption
            title="Into the real EHR"
            lines={[
              [0.85, "When the clinic gets internet, its visits go to the EHR on their own."],
              [3.0, "A real EHR: Medplum, over the FHIR standard."],
              [5.6, "Each visit becomes a patient, an encounter and eight observations."],
              [9.0, "Ada's phone sends its copy too. The EHR refuses the duplicate."],
              [11.6, "Phones only ever add visits. The EHR stays the record of truth."],
            ]}
          />
        </Sequence>
      </Track>
      <Track name="Music">
        {/* "Wholesome" by Kevin MacLeod (incompetech.com), CC BY 4.0: credit it wherever the video is posted. */}
        <Audio
          name="Wholesome"
          src={staticFile("music/wholesome.mp3")}
          durationInFrames={durationInFrames}
          volume={(f) =>
            interpolate(
              f,
              // soft under the opening lines, settling in as the phone arrives, ducked ~3 dB under
              // the risk bands and the visit reaching the clinic, easing out with the closing fade
              [0, 3.6 * fps, 4.6 * fps, 51.2 * fps, 51.6 * fps, 53.4 * fps, 54 * fps, 64.8 * fps, 65.2 * fps, 66.8 * fps, 67.4 * fps, 99 * fps, 101 * fps, 107.1 * fps],
              [0.18, 0.18, 0.32, 0.32, 0.22, 0.22, 0.32, 0.32, 0.22, 0.22, 0.32, 0.32, 0.24, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      </Track>
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
