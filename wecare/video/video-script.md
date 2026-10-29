# WeCare launch video: script

This describes the video as built in `src/` (composition `Launch`). Times inside a beat are seconds from the beat's start.

**Vibe:** calm and cozy healthcare, not an upbeat launch. Soft light, slow eases, quiet sound, a human opening.
**Length:** 1:47 (107.2 s). **Format:** 16:9, 1920×1080, 60 fps.
**Sound:** "Wholesome" by Kevin MacLeod as a warm, steady music bed, with quiet UI sound effects (about 0.55× the usual level) on the frame of the visual event that causes them. The captions tell the whole story, so it works muted.
**Look:** mock UI rebuilt from the app's own tokens, fonts and icons (`src/ui/kit.tsx`), not screen-captured. Pastel sky-blue screens (`#E1EFF4`), one maroon accent (`#6E1F30`), and green, amber, orange and red used only for state and risk. Titles in Neuton, everything else in Host Grotesk, Lucide icons at stroke 1.75. Black phone frames with soft shadows sit on a light, slow-moving wallpaper made from the app's own sky blue, with a warm blush and cream. Captions use the app's ink: titles in Neuton, descriptions in Host Grotesk.
**Touch:** a soft, ink-tinted touch dot moves on eased paths. Each tap presses the dot, throws a ripple and plays a click.
**Camera:** the frame never stops moving. A slow Ken Burns drift runs under everything. Punch-ins follow the action but stay gentle: each goes a quarter less deep than the numbers below (so 1.9× plays as about 1.7×), with slow eases and no shake.
**Cast:** the app's synthetic roster and its own example names. **Ada** is the health worker you follow. **Ben** is a second health worker whose phone carries the visit. **Riverside Clinic** is the clinic hub. The patient is **Ruth Njeri** (Female, 80 · Well Corner 7). Other visits on the clinic list: Samuel Otieno (School Path 3), Peter Achieng (Market Lane 2) and Grace Mwangi (River Road 11).

### Caption band

- **Position:** the bottom 20% of the frame, fixed and unaffected by the camera.
- **Scrim:** a pastel gradient behind the band, up to about 90%, so ink text stays readable over the phone.
- **Two lines, centred:** the title in Neuton Bold (64 px, ink) and a description line in Host Grotesk (34 px, muted ink).
- **Description lines:** each feature has three to five lines, each with its own start time. A line fades and rises in over 0.5 s and fades out 0.3 s before the next one starts, so the description follows what the phone is doing. The first line waits for the title to settle (about 1.3 s).
- **Framing rule:** each punch-in is aimed so the action sits just above the band (about 110 px above the frame centre). When the target is low on the phone (the keyboard, the Save button, the sync card), the camera moves down so the phone rides up.

### Sound palette

| Sound | Plays on |
|-------|----------|
| **Tap** (soft click, quiet) | Every touch-dot tap, every stepper press, and the risk bands landing in the score cutaway. |
| **Key clicks** | Each character of "Ada" typed. A quieter tap, varied in volume. |
| **Whoosh** | Something moving: a phone sliding in or out, the scanner opening, the sealed record leaving a phone, the receipt travelling back, the record flying into the EHR. |
| **Toggle** | **Enrolled** ticking in, **Enroll** accepted, **At the clinic** ticking in, each **In EHR** pill, and the Wi-Fi icon appearing. |
| **Chime** | Only arrivals on the clinic phone: the enrollment request landing and each visit landing in **Visits received**. |

**Music:** soft under the opening lines, settling in as the phone arrives. Ducked about 3 dB under the score cutaway (Emergency transfer) and the record reaching the clinic, easing out with the closing fade. Credit it wherever the video is posted: `Music: "Wholesome" by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0`.

### The repeating feature beat

1. **0.0 s:** the title rises in softly (0.6 s), large and centred over the phone. A pastel veil settles over the whole phone screen.
2. **0.8 s:** the title glides down into the caption band (0.6 s). The veil lifts, the camera eases in on the action, and the first description line fades in once the title has settled (about 1.3 s).
3. **The feature plays out**, with a hold after every change so the screen can be read, and the description lines change as it goes.
4. **0.5 s before the end:** the camera punches out to the centred phone, the caption fades down and out, and the next title lands straight away.

The phone's screen content hard-cuts between beats. Beats that pass a record between phones use two or three phones side by side (`Duo` and `Trio`).

---

## 0:00–0:04 · Cold open

**Screen:** the pastel wallpaper, with no phone yet. Two quiet lines rise in slowly (0.9 s each), centred a little above the middle:

> **Ruth lives an hour from the nearest clinic.** (0.3, Neuton Bold, 84 px, ink)
> There's no signal at the door. (1.6, Neuton, 60 px, muted ink)

At 3.1 s both lines drift up a little and fade out by 3.6 s. The phone starts rising 0.4 s later.

## 0:04–0:07 · Phone enters

The phone rises from below the frame and settles softly, with no overshoot (0.9 s). It's open on **Riverside Clinic**, the hub's busiest screen. The status line reads **Mesh on · 2 nearby · no internet needed** with a green dot. Under **Visits received (3)**, three visit cards are sorted sickest first: Samuel Otieno **NEWS2 5 · Medium**, Peter Achieng **NEWS2 3 · Low-medium**, Grace Mwangi **NEWS2 0 · Low**. The camera eases in from 0.94× to 1×.

**Caption band:** `WeCare`, fading out as the first title lands.

**SFX:** a whoosh as the phone slides up.

---

## 0:07–0:18 · 1. Set up a phone (11 s)

**Phone:** hard cut to the **WeCare** welcome screen: "Home visits that reach the clinic with no signal. Phones pass sealed records to one another over Bluetooth until one arrives." Under **This phone is for**, the **Health worker** card is selected (maroon border, check).
1. At 1.8 the dot taps **Clinic hub**. The border and check move, and the Name placeholder changes to "Clinic name, for example Riverside Clinic".
2. At 3.0 it taps **Health worker** again, and the placeholder reads "Your name, for example Ada".
3. At 4.2 it taps the **Name** field. The keyboard comes up and "Ada" types in from 4.7 (0.13 s per character), with the camera pushing in to 2×.
4. The keyboard drops (6.2), and **Start** is tapped at 6.8.
5. Hard cut (7.2) to Ada's home: the header **Ada** and **Mesh on · 2 nearby · no internet needed** with a green dot (punch-in on the status line). The clinic card reads **No clinic yet**, "Scan the clinic's code while you are close to its phone.", over a **Scan clinic code** button.

| At | Description |
|----|-------------|
| 0.85 | One app, two jobs: a health worker's phone or the clinic's hub. |
| 4.2 | No account and no sign-up. Just a name. |
| 7.2 | The mesh starts straight away. No internet needed. |

## 0:18–0:32 · 2. Enroll with a scan (14 s)

**Split:** Ada's phone shrinks to 0.9× and slides left. The Riverside Clinic phone slides in from the right with an overshoot, open on **Health workers (0)** with **Hide code** and the QR card: "Scan this with WeCare on the health worker's phone, close by. It carries this clinic's key, not a password."
1. Left: at 1.6 Ada taps **Scan clinic code**. Hard cut to the scanner (whoosh): a dark camera view with a white rounded square guide, the title **Scan the clinic's code**, and a **Cancel** pill at the bottom. A blurred QR drifts into the square.
2. Left: at 3.0 the square flashes and the scanner closes (whoosh). The clinic card now reads **Riverside Clinic**, "Waiting for the clinic to accept. Stay close to the clinic phone."
3. Right: at 4.6 the request card drops in at the top with a maroon border: **Ada would like to enroll**, `off1q964…4trw`, with **Enroll** and **Decline** buttons (chime). The camera punches in on it.
4. Right: at 6.8 the dot taps **Enroll** (toggle). The card leaves, and **Health workers (1)** lists **Ada** `off1q964…4trw`.
5. Left: at 7.1 **Enrolled. Visits are sealed for this clinic alone.** ticks in, in green with a check (toggle). The camera punches in on it (9.0–12.5).

| At | Description |
|----|-------------|
| 0.85 | The clinic shows a code. It carries the clinic's key, not a password. |
| 3.0 | The phone checks the code is genuine before it sends a thing. |
| 4.8 | Scanning is not enough to join: someone at the clinic taps Enroll. |
| 7.4 | From now on, Ada's visits are sealed for this clinic alone. |

The Riverside Clinic phone slides out right at 13.4, and Ada's phone grows back to the centre.

## 0:32–0:45 · 3. Record the visit (13 s)

**Phone:** Ada's home. At 1.6 the dot taps **New visit**. Hard cut to the **New visit** form. The score banner stays pinned at the top: **0**, **Routine follow-up**, "NEWS2, low risk. Scored on this phone, for adults." on soft green.
1. Under **Patient**, the roster chips wrap: Amina Okello, Joseph Okello (both Hillside 4), Grace Mwangi, Peter Achieng, Ruth Njeri, Samuel Otieno. At 2.8 the dot taps **Ruth Njeri**: maroon fill and a check.
2. At 4.4 the form scrolls to **Vitals**, with each row's icon, label, value and **−**/**+** steppers: Breathing 16 /min, SpO₂ 97 %, Systolic BP 122 mmHg, Pulse 76 /min, Temperature 36.8 °C, all reading **In range**. Below them is **On supplemental oxygen**, "Room air", with its switch.
3. From 5.4 the dot presses Breathing **+** five times, 0.4 s apart (a tap on each). The value climbs to 21, the subline turns orange, **+2 to score**, and the banner ticks to **2**.
4. From 7.8 it presses SpO₂ **−** three times. The value falls to 94, **+1 to score**, and the banner ticks to **3**, still green.
5. Hold on the vitals card to the end (10.0–12.5), with the camera on the orange sublines.

| At | Description |
|----|-------------|
| 0.85 | Pick who you're with from the household list. |
| 4.4 | Step each vital in as you measure it. No typing on a doorstep. |
| 7.8 | Every reading shows what it adds to the score. |

## 0:45–0:57 · 4. The score, on the spot (12 s)

**Phone:** the same form, with the camera on the score banner.
1. At 1.4 the dot taps **New confusion** under **Alertness**. The pill fills maroon, and the banner jumps to **6**: **Urgent referral** on orange, "NEWS2, medium risk."
2. At 3.6 the form scrolls up and the dot taps the **Deteriorating** preset beside **Vitals**. Every row jumps: Breathing 27, SpO₂ 90, Systolic BP 96, Pulse 124 and Temperature 39.4, each with an orange **+3**/**+2 to score**. The banner counts up to **15** and turns red: **Emergency transfer**, "NEWS2, high risk. Scored on this phone, for adults." The 15 swells gently as it lands.

**Hero cutaway (6.4–8.6):** a pastel veil over the phone. The four bands pop in, stacked, one after another (a tap each): **Routine follow-up** (green), **Refer today** (amber), **Urgent referral** (orange), **Emergency transfer** (red, biggest, with a glow). The music ducks.

3. Back on the form, scrolled to the bottom (8.8): **Save visit for Ruth** and "Saved on this phone first, then carried to the clinic sealed, through any phones in between." The camera moves down so the button sits above the band. The dot taps Save at 10.0.
4. Hard cut (10.3) to Ada's home. Ruth Njeri's visit card sits under **Today's visits (1)**: "Female, 80 · Well Corner 7", **NEWS2 15 · High**, the six-cell vitals grid, then **On this phone, finding a route** and **Not in EHR yet**.

| At | Description |
|----|-------------|
| 0.85 | NEWS2, the early-warning score used across the NHS, worked out on the phone. |
| 3.6 | It turns the vitals into one clear next step. |
| 6.4 | From routine follow-up to emergency transfer. |
| 8.8 | Saved on the phone first, whether there's signal or not. |

## 0:57–1:13 · 5. Carried by the next phone (16 s)

**Trio:** the camera pulls out, and Ada's phone shrinks to 0.72× and slides left. The Riverside Clinic phone slides in on the right at the same size, open on **Visits received (3)**. A faint dashed circle around each phone shows its Bluetooth reach. Ada's circle and the clinic's don't meet.
1. Left: Ada's card shows **On this phone, finding a route**, its clock icon pulsing.
2. Middle: at 2.2 **Ben**'s phone rises into the gap (whoosh), open on **Carried for others**: **0** sealed records passed along for others. Its reach circle overlaps both of the others.
3. At 3.6 a small maroon tile with a lock leaves Ada's phone and arcs into Ben's (whoosh). At 4.2 Ben's card ticks to **1 sealed record passed along for others**, "Encrypted for their recipient. Unreadable here." with the row `Ada → Riverside Clinic 10:42`. The camera punches in on Ben's card (2×, 4.4–7.0).
4. At 7.4 the tile arcs on from Ben's phone into the clinic's (whoosh). At 8.0 Ruth Njeri's card drops in at the top of **Visits received (4)**, above Samuel, with **NEWS2 15 · High** and the footer "Ada, via 1 other phone, 10:42" (chime). The music ducks.
5. At 9.6 a smaller tile, the receipt, travels back: clinic, then Ben, then Ada (a soft whoosh). At 10.6 Ada's pill flips to **At the clinic**, in green with a check (toggle). The camera punches in on it (11.0–14.5).

| At | Description |
|----|-------------|
| 0.85 | Still no signal at Ruth's door, so the visit waits on Ada's phone. |
| 2.6 | Any WeCare phone that comes within range carries it on. |
| 4.4 | Sealed for the clinic: the phone in the middle can't read a word. |
| 8.0 | It reaches the clinic, hopping phone to phone over Bluetooth. |
| 10.4 | The clinic's receipt comes back the same way. Until then, Ada's phone keeps resending. |

At 15.0 Ben's and Ada's phones slide out, and the clinic phone grows to the centre.

## 1:13–1:24 · 6. Sickest first (11 s)

**Phone:** **Riverside Clinic**, **Visits received (4)**: Ruth Njeri **NEWS2 15 · High** on top, then Samuel Otieno **NEWS2 5 · Medium**, Peter Achieng **NEWS2 3 · Low-medium** and Grace Mwangi **NEWS2 0 · Low**.
1. At 1.8 another visit lands (chime): Joseph Okello, **NEWS2 6 · Medium**, "Ben, direct". It slots in below Ruth instead of at the top, and the cards below slide down.
2. At 4.6 the camera punches in on Ruth's card (1.9×): Breathing 27/min, SpO₂ 90%, Systolic 96 mmHg, Pulse 124/min, Temp 39.4 °C, Alertness Confused.
3. At 7.8 the camera moves to the top of the screen: **Health workers (2)**, Ada and Ben with their short addresses.

| At | Description |
|----|-------------|
| 0.85 | The clinic sees every visit, sickest first. |
| 2.4 | New arrivals slot in by risk, not by time. |
| 4.8 | The clinic re-scores every visit itself. It never trusts the number sent. |
| 7.8 | And it only takes visits from phones it enrolled. |

## 1:24–1:39 · 7. Into the real EHR (15 s)

**Split:** the clinic phone shrinks to 0.9× and slides left, and Ada's phone slides in on the right.
1. Left: the clinic's screen scrolls to **Electronic health record**: **5 visits waiting for the EHR**, "Sends on its own once this phone is online. Copies the EHR already has are refused there." and a **Send to EHR now** button. At 1.6 a Wi-Fi icon appears in its status bar (toggle).
2. Left: at 2.6 **Medplum: 5 added** ticks in, in green, and **Everything is in the EHR** replaces the count. Scrolling up, each visit's **Not in EHR yet** pill flips to **In EHR**, top to bottom, 0.15 s apart (a toggle on the first).

**Hero cutaway (5.4–8.4):** a pastel veil with an EHR record card in Medplum's style: **Ruth Njeri**, *Encounter · home health · Ada (community health worker)*. Under it, a **Patient**, an **Encounter** and **8 Observations** stack in one by one: Respiratory rate 27 /min, Oxygen saturation 90 %, Systolic blood pressure 96 mmHg, Heart rate 124 /min, Body temperature 39.4 °C, On supplemental oxygen, Level of consciousness (ACVPU) C, NEWS2 total score 15. A small line underneath reads **FHIR R4 · Medplum**.

3. Right: at 9.0 Ada's phone gets Wi-Fi too (toggle). Ruth's card pill flips from **Not in EHR yet** to **In EHR, already there** (toggle), and the camera punches in on it.
4. Left: the clinic list holds **one** Ruth Njeri visit throughout.

| At | Description |
|----|-------------|
| 0.85 | When the clinic gets internet, its visits go to the EHR on their own. |
| 3.0 | A real EHR: Medplum, over the FHIR standard. |
| 5.6 | Each visit becomes a patient, an encounter and eight observations. |
| 9.0 | Ada's phone sends its copy too. The EHR refuses the duplicate. |
| 11.6 | Phones only ever add visits. The EHR stays the record of truth. |

---

## 1:39–1:40 · Exit

Both phones sink a little (260 px) and fade out over 1 s, with a quiet whoosh. Only the wallpaper remains, and the music begins to ease.

## 1:40–1:47 · Close

The text starts 0.4 s after the phones have gone. Every phrase rises in on its own, slowly, centred a little above the middle.
1. **Every visit** (0.3) · **finds its way** (0.95) · **to the clinic.** (1.6, in maroon). Neuton Bold, 88 px, on one line.
2. At 2.9 the line fades out. From 3.4 the WeCare mark settles in: the app icon (the maroon cross on a soft disc) beside **WeCare** in Neuton Bold, 132 px.
3. **Built on Offline Protocol** (4.4) rises in underneath, Host Grotesk, 36 px, muted ink.

From 6.0 everything fades back into the wallpaper as the music eases out to silence.

---

## Caption sheet

| # | Title | Description lines |
|---|-------|-------------------|
| 1 | Set up a phone | One app, two jobs: a health worker's phone or the clinic's hub. / No account and no sign-up. Just a name. / The mesh starts straight away. No internet needed. |
| 2 | Enroll with a scan | The clinic shows a code. It carries the clinic's key, not a password. / The phone checks the code is genuine before it sends a thing. / Scanning is not enough to join: someone at the clinic taps Enroll. / From now on, Ada's visits are sealed for this clinic alone. |
| 3 | Record the visit | Pick who you're with from the household list. / Step each vital in as you measure it. No typing on a doorstep. / Every reading shows what it adds to the score. |
| 4 | The score, on the spot | NEWS2, the early-warning score used across the NHS, worked out on the phone. / It turns the vitals into one clear next step. / From routine follow-up to emergency transfer. / Saved on the phone first, whether there's signal or not. |
| 5 | Carried by the next phone | Still no signal at Ruth's door, so the visit waits on Ada's phone. / Any WeCare phone that comes within range carries it on. / Sealed for the clinic: the phone in the middle can't read a word. / It reaches the clinic, hopping phone to phone over Bluetooth. / The clinic's receipt comes back the same way. Until then, Ada's phone keeps resending. |
| 6 | Sickest first | The clinic sees every visit, sickest first. / New arrivals slot in by risk, not by time. / The clinic re-scores every visit itself. It never trusts the number sent. / And it only takes visits from phones it enrolled. |
| 7 | Into the real EHR | When the clinic gets internet, its visits go to the EHR on their own. / A real EHR: Medplum, over the FHIR standard. / Each visit becomes a patient, an encounter and eight observations. / Ada's phone sends its copy too. The EHR refuses the duplicate. / Phones only ever add visits. The EHR stays the record of truth. |

## Where it lives

- `src/Launch.tsx`: the timeline (beat starts and lengths in `BEATS`), the caption lines and the music volume envelope.
- `src/scenes.tsx`: each beat's camera keyframes, taps, typing, hero cutaways and sound effects. Tap targets are named constants at the top, measured from stills of the screens at 1:1.
- `src/screens.tsx`: the mock app screens, rebuilt from the app's components. `src/ui.tsx`: the phone, status bar, touch dot, keyboard and component kit. `src/type.tsx`: the wallpaper, drift, captions and kinetic type.
- `src/data.ts`: the cast and visits. NEWS2 and the patient roster are imported from the app (`../src/domain`), so the scores on screen are the app's own.
- `npm run dev` opens Studio (pass `--port=3001` while Medplum holds 3000). `npx remotion render Launch out/launch.mp4 --codec=h264 --crf=18` renders. The sound effects stream from `remotion.media`, so rendering needs internet.
