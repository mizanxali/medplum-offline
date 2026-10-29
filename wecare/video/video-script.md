# WeCare launch video: script

This describes the video as built in `src/` (composition `Launch`). Each feature opens with a 4.8 s side-by-side intro; times inside a beat are seconds on the beat's own timeline, which picks up 4.2 s into the beat (at its 0.6 s mark) as the intro hands over.

**Vibe:** calm and cozy healthcare, not an upbeat launch. Soft light, slow eases, silence, a human opening.
**Length:** 2:17 (136.6 s). **Format:** 16:9, 1920×1080, 60 fps.
**Sound:** none. The video is silent and made to be watched muted: the side text tells the story.
**Look:** mock UI rebuilt from the app's own tokens, fonts and icons (`src/ui/kit.tsx`), not screen-captured. Pastel sky-blue screens (`#E1EFF4`), one maroon accent (`#6E1F30`), and green, amber, orange and red used only for state and risk. Titles in Neuton, everything else in Host Grotesk, Lucide icons at stroke 1.75. Black phone frames with soft shadows sit on a light, slow-moving wallpaper made from the app's own sky blue, with a warm blush and cream. Text uses the app's ink: titles in Neuton, descriptions in Host Grotesk. No subtitles and no overlays on the phone.
**Touch:** a soft, ink-tinted touch dot moves on eased paths. Each tap presses the dot and throws a ripple.
**Camera:** the frame never stops moving. A slow Ken Burns drift runs under everything. Punch-ins follow the action but stay gentle: each goes a quarter less deep than the numbers below (so 1.9× plays as about 1.7×), with slow eases and no shake.
**Cast:** the app's synthetic roster and its own example names. **Ada** is the health worker you follow. **Ben** is a second health worker whose phone carries the visit. **Riverside Clinic** is the clinic hub. The patient is **Ruth Njeri** (Female, 80 · Well Corner 7). Other visits on the clinic list: Samuel Otieno (School Path 3), Peter Achieng (Market Lane 2) and Grace Mwangi (River Road 11).

### The repeating feature beat

1. **Intro (0 to 4.8 s).** The phone glides from the centre to one side (0.9 s) and settles at 0.92×. The title (Neuton Bold, 78 px) and a two- or three-sentence description (Host Grotesk, 34 px, muted ink) rise in on the other side (0.35 to 1.25 s). Sides alternate: phone left for features 1, 3, 5 and 7, right for 2, 4 and 6.
2. **Hand-over (3.9 to 4.8 s).** The text slides out toward its own edge, and the phone glides back to the centre (or to its place in a split) as the beat's own timeline starts.
3. **The feature plays out**, with the camera easing in on each action and a hold after every change so the screen can be read.
4. **The end.** The camera eases back out to the centred phone, ready for the next intro to carry it to the side.

In split-screen and three-phone beats, the intro carries the main phone (Ada's, or the clinic's) to the side, and the other phones only enter once the text has gone. Screens change inside the phone the way iOS does, never with a cut: a push slides a new screen in from the right over the old one (which drifts a third of the way and shades), a pop slides it back off, the scanner rises as a full-screen sheet and sinks away, and a change that isn't navigation fades through the app's background. The camera glides across every change.

---

## 0:00 to 0:04 · Cold open

**Screen:** the pastel wallpaper, with no phone yet. Two quiet lines rise in slowly (0.9 s each), centred a little above the middle:

> **Ruth lives an hour from the nearest clinic.** (0.3, Neuton Bold, 84 px, ink)
> There's no signal at the door. (1.6, Neuton, 60 px, muted ink)

At 3.1 s both lines drift up a little and fade out by 3.6 s. The phone starts rising 0.4 s later.

## 0:04 to 0:07 · Phone enters

The phone rises from below the frame and settles softly, with no overshoot (0.9 s). It's open on **Riverside Clinic**, the hub's busiest screen. The status line reads **Mesh on · 2 nearby · no internet needed** with a green dot. Under **Visits received (3)**, three visit cards are sorted sickest first: Samuel Otieno **NEWS2 5 · Medium**, Peter Achieng **NEWS2 3 · Low-medium**, Grace Mwangi **NEWS2 0 · Low**. The camera eases in from 0.94× to 1×.



---

## 0:07 to 0:22 · 1. Set up a phone (15.2 s)

**Phone:** the **WeCare** welcome screen (the clinic screen fades through to it as the phone settles, 2.3 to 2.95 s into its entrance): "Home visits that reach the clinic with no signal. Phones pass sealed records to one another over Bluetooth until one arrives." Under **This phone is for**, the **Health worker** card is selected (maroon border, check).
1. At 1.8 the dot taps **Clinic hub**. The border and check move, and the Name placeholder changes to "Clinic name, for example Riverside Clinic".
2. At 3.0 it taps **Health worker** again, and the placeholder reads "Your name, for example Ada".
3. At 4.2 it taps the **Name** field. The keyboard comes up and "Ada" types in from 4.7 (0.13 s per character), with the camera pushing in to 2×.
4. The keyboard drops (6.2), and **Start** is tapped at 6.8.
5. The welcome screen fades through to Ada's home (6.95 to 7.6), while the camera glides up to the status line: the header **Ada** and **Mesh on · 2 nearby · no internet needed** with a green dot (punch-in on the status line). The clinic card reads **No clinic yet**, "Scan the clinic's code while you are close to its phone.", over a **Scan clinic code** button.

**Intro:** phone on the left, with the text:

> One app, two jobs: the health worker's phone or the clinic's hub. No account and no sign-up, and the mesh starts with no internet.

## 0:22 to 0:40 · 2. Enroll with a scan (18.2 s)

**Split:** Ada's phone sits on the right (0.95×), and the Riverside Clinic phone glides in from the left, open on **Health workers (0)** with **Hide code** and the QR card: "Scan this with WeCare on the health worker's phone, close by. It carries this clinic's key, not a password."
1. Right: at 1.6 Ada taps **Scan clinic code**. The scanner rises over Ada's home as a full-screen sheet (1.7 to 2.3): a dark camera view with a white rounded square guide, the title **Scan the clinic's code**, and a **Cancel** pill at the bottom. A blurred QR drifts into the square.
2. Right: at 3.0 the square flashes and the scanner sheet sinks away (3.1 to 3.65). The clinic card now reads **Riverside Clinic**, "Waiting for the clinic to accept. Stay close to the clinic phone."
3. Left: at 4.6 the request card drops in at the top with a maroon border: **Ada would like to enroll**, `off1q964…4trw`, with **Enroll** and **Decline** buttons. The camera punches in on it.
4. Left: at 6.8 the dot taps **Enroll**. The card leaves, and **Health workers (1)** lists **Ada** `off1q964…4trw`.
5. Right: at 7.1 **Enrolled. Visits are sealed for this clinic alone.** ticks in, in green with a check. The camera punches in on it (9.0 to 12.5).

**Intro:** phone on the right, with the text:

> The clinic shows a code that carries its key, not a password. Someone at the clinic taps Enroll, and Ada's visits are sealed for that clinic alone.

The Riverside Clinic phone glides out left at 13.3, and Ada's phone moves back to the centre.

## 0:40 to 0:57 · 3. Record the visit (17.2 s)

**Phone:** Ada's home. At 1.6 the dot taps **New visit**, and the **New visit** form pushes in from the right (1.7 to 2.25). The score banner stays pinned at the top: **0**, **Routine follow-up**, "NEWS2, low risk. Scored on this phone, for adults." on soft green.
1. Under **Patient**, the roster chips wrap: Amina Okello, Joseph Okello (both Hillside 4), Grace Mwangi, Peter Achieng, Ruth Njeri, Samuel Otieno. At 2.8 the dot taps **Ruth Njeri**: maroon fill and a check.
2. At 4.4 the form scrolls to **Vitals**, with each row's icon, label, value and **−**/**+** steppers: Breathing 16 /min, SpO₂ 97 %, Systolic BP 122 mmHg, Pulse 76 /min, Temperature 36.8 °C, all reading **In range**. Below them is **On supplemental oxygen**, "Room air", with its switch.
3. From 5.4 the dot presses Breathing **+** five times, 0.4 s apart. The value climbs to 21, the subline turns orange, **+2 to score**, and the banner ticks to **2**.
4. From 7.8 it presses SpO₂ **−** three times. The value falls to 94, **+1 to score**, and the banner ticks to **3**, still green.
5. Hold on the vitals card to the end (10.0 to 12.5), with the camera on the orange sublines.

**Intro:** phone on the left, with the text:

> Pick who you're with, then step each vital in as you measure it. No typing on a doorstep, and every reading shows what it adds to the score.

## 0:57 to 1:13 · 4. The score, on the spot (16.2 s)

**Phone:** the same form, with the camera on the score banner.
1. At 1.4 the dot taps **New confusion** under **Alertness**. The pill fills maroon, and the banner jumps to **6**: **Urgent referral** on orange, "NEWS2, medium risk."
2. At 3.6 the form scrolls up and the dot taps the **Deteriorating** preset beside **Vitals**. Every row jumps: Breathing 27, SpO₂ 90, Systolic BP 96, Pulse 124 and Temperature 39.4, each with an orange **+3**/**+2 to score**. The banner counts up to **15** and turns red: **Emergency transfer**, "NEWS2, high risk. Scored on this phone, for adults." The 15 swells gently as it lands.

**Hero cutaway (6.4 to 8.6):** a pastel veil over the phone. The four bands pop in, stacked, one after another: **Routine follow-up** (green), **Refer today** (amber), **Urgent referral** (orange), **Emergency transfer** (red, biggest, with a glow).

3. Back on the form, scrolled to the bottom (8.8): **Save visit for Ruth** and "Saved on this phone first, then carried to the clinic sealed, through any phones in between." The camera moves down so the button sits above the band. The dot taps Save at 10.0.
4. The form slides away to the right, back to Ada's home (10.15 to 10.7). Ruth Njeri's visit card sits under **Today's visits (1)**: "Female, 80 · Well Corner 7", **NEWS2 15 · High**, the six-cell vitals grid, then **On this phone, finding a route** and **Not in EHR yet**.

**Intro:** phone on the right, with the text:

> NEWS2, the early-warning score used across the NHS, worked out on the phone. One clear next step, from routine follow-up to emergency transfer.

## 1:13 to 1:34 · 5. Carried by the next phone (20.2 s)

**Trio:** Ada's phone sits on the left at 0.75×. At 0.7 the Riverside Clinic phone glides in on the right at the same size, open on **Visits received (3)**. A faint dashed circle around each phone shows its Bluetooth reach. Ada's circle and the clinic's don't meet.
1. Left: Ada's card shows **On this phone, finding a route**, its clock icon pulsing.
2. Middle: at 2.2 **Ben**'s phone rises into the gap, open on **Carried for others**: **0** sealed records passed along for others. Its reach circle overlaps both of the others.
3. At 3.6 a small maroon tile with a lock leaves Ada's phone and arcs into Ben's. At 4.2 Ben's card ticks to **1 sealed record passed along for others**, "Encrypted for their recipient. Unreadable here." with the row `Ada → Riverside Clinic 10:42`. The camera punches in on Ben's card (2×, 4.4 to 7.0).
4. At 7.4 the tile arcs on from Ben's phone into the clinic's. At 8.0 Ruth Njeri's card drops in at the top of **Visits received (4)**, above Samuel, with **NEWS2 15 · High** and the footer "Ada, via 1 other phone, 10:42".
5. At 9.6 a smaller tile, the receipt, travels back: clinic, then Ben, then Ada. At 10.6 Ada's pill flips to **At the clinic**, in green with a check. The camera punches in on it (11.0 to 14.5).

**Intro:** phone on the left, with the text:

> No signal at Ruth's door, so the visit waits on Ada's phone. The next WeCare phone carries it on, sealed: it can't read a word. The receipt comes back the same way.

At 15.0 Ben's and Ada's phones slide out, and the clinic phone grows to the centre.

## 1:34 to 1:49 · 6. Sickest first (15.2 s)

**Phone:** **Riverside Clinic**, **Visits received (4)**: Ruth Njeri **NEWS2 15 · High** on top, then Samuel Otieno **NEWS2 5 · Medium**, Peter Achieng **NEWS2 3 · Low-medium** and Grace Mwangi **NEWS2 0 · Low**.
1. At 1.8 another visit lands: Joseph Okello, **NEWS2 6 · Medium**, "Ben, direct". It slots in below Ruth instead of at the top, and the cards below slide down.
2. At 4.6 the camera punches in on Ruth's card (1.9×): Breathing 27/min, SpO₂ 90%, Systolic 96 mmHg, Pulse 124/min, Temp 39.4 °C, Alertness Confused.
3. At 7.8 the camera moves to the top of the screen: **Health workers (2)**, Ada and Ben with their short addresses.

**Intro:** phone on the right, with the text:

> Every visit lands on the clinic's list by risk, not by time. The clinic re-scores each one itself, and only takes visits from phones it enrolled.

## 1:49 to 2:08 · 7. Into the real EHR (19.2 s)

**Split:** the clinic phone sits on the left (0.95×), and Ada's phone glides in on the right at 0.6.
1. Left: the clinic's screen scrolls to **Electronic health record**: **5 visits waiting for the EHR**, "Sends on its own once this phone is online. Copies the EHR already has are refused there." and a **Send to EHR now** button. At 1.6 a Wi-Fi icon appears in its status bar.
2. Left: at 2.6 **Medplum: 5 added** ticks in, in green, and **Everything is in the EHR** replaces the count. Scrolling up, each visit's **Not in EHR yet** pill flips to **In EHR**, top to bottom, 0.15 s apart.

**Hero cutaway (5.4 to 8.4):** a pastel veil with an EHR record card in Medplum's style: **Ruth Njeri**, *Encounter · home health · Ada (community health worker)*. Under it, a **Patient**, an **Encounter** and **8 Observations** stack in one by one: Respiratory rate 27 /min, Oxygen saturation 90 %, Systolic blood pressure 96 mmHg, Heart rate 124 /min, Body temperature 39.4 °C, On supplemental oxygen, Level of consciousness (ACVPU) C, NEWS2 total score 15. A small line underneath reads **FHIR R4 · Medplum**.

3. Right: at 9.0 Ada's phone gets Wi-Fi too. Ruth's card pill flips from **Not in EHR yet** to **In EHR, already there**, and the camera punches in on it.
4. Left: the clinic list holds **one** Ruth Njeri visit throughout.

**Intro:** phone on the left, with the text:

> Once the clinic is online, each visit goes to Medplum over FHIR: a patient, an encounter and eight observations. Ada's copy arrives too, and the EHR keeps one.

---

## 2:08 to 2:09 · Exit

Both phones sink a little (260 px) and fade out over 1 s, Only the wallpaper remains.

## 2:09 to 2:16 · Close

The text starts 0.4 s after the phones have gone. Every phrase rises in on its own, slowly, centred a little above the middle.
1. **Every visit** (0.3) · **finds its way** (0.95) · **to the clinic.** (1.6, in maroon). Neuton Bold, 88 px, on one line.
2. At 2.9 the line fades out. From 3.4 the WeCare mark settles in: the app icon (the maroon cross on a soft disc) beside **WeCare** in Neuton Bold, 132 px.
3. **Built on Offline Protocol** (4.4) rises in underneath, Host Grotesk, 36 px, muted ink.

From 6.0 everything fades back into the wallpaper.

---

## Side text sheet

| # | Title | Phone | Text |
|---|-------|-------|------|
| 1 | Set up a phone | left | One app, two jobs: the health worker's phone or the clinic's hub. No account and no sign-up, and the mesh starts with no internet. |
| 2 | Enroll with a scan | right | The clinic shows a code that carries its key, not a password. Someone at the clinic taps Enroll, and Ada's visits are sealed for that clinic alone. |
| 3 | Record the visit | left | Pick who you're with, then step each vital in as you measure it. No typing on a doorstep, and every reading shows what it adds to the score. |
| 4 | The score, on the spot | right | NEWS2, the early-warning score used across the NHS, worked out on the phone. One clear next step, from routine follow-up to emergency transfer. |
| 5 | Carried by the next phone | left | No signal at Ruth's door, so the visit waits on Ada's phone. The next WeCare phone carries it on, sealed: it can't read a word. The receipt comes back the same way. |
| 6 | Sickest first | right | Every visit lands on the clinic's list by risk, not by time. The clinic re-scores each one itself, and only takes visits from phones it enrolled. |
| 7 | Into the real EHR | left | Once the clinic is online, each visit goes to Medplum over FHIR: a patient, an encounter and eight observations. Ada's copy arrives too, and the EHR keeps one. |

## Where it lives

- `src/Launch.tsx`: the timeline (beat lengths in `LENGTHS`, starts derived) and each feature's side, title and text.
- `src/scenes.tsx`: `Featured` (the side-by-side intro and hand-over), then each beat's camera keyframes, taps, typing and hero cutaways. Tap targets are named constants at the top, measured from stills of the screens at 1:1.
- `src/screens.tsx`: the mock app screens, rebuilt from the app's components. `src/ui.tsx`: the phone, status bar, touch dot, keyboard and component kit. `src/type.tsx`: the wallpaper, drift and soft text.
- `src/data.ts`: the cast and visits. NEWS2 and the patient roster are imported from the app (`../src/domain`), so the scores on screen are the app's own.
- `npm run dev` opens Studio (pass `--port=3001` while Medplum holds 3000). `npx remotion render Launch out/launch.mp4 --codec=h264 --crf=18` renders.
