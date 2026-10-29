# CareRounds

Community health worker visits with no signal. A health worker records a
home visit and gets an early-warning score on the phone. The record travels
to the clinic sealed, over Bluetooth, through any other health worker's phone
in between, and lands in a real EHR (Medplum, over FHIR R4) as soon as any
phone holding it has internet.

Built on [`@offline-protocol/mesh-sdk`](https://www.npmjs.com/package/@offline-protocol/mesh-sdk) 0.31,
React Native 0.88. Patients are synthetic; no real person is behind any record.

## What it shows

- **Sealed relay.** A visit goes from the health worker to the clinic as an
  MLS-encrypted 1:1 message. A third phone in between forwards it (and holds
  it if the next hop is out of range) and shows that it did, under *Carried
  for others*, but it can only see who the frame is from and to, never the
  vitals inside.
- **Enrollment by QR.** The clinic shows a code from the SDK's
  `createInvite`. The health worker's phone scans it, `parseInvite` checks
  that the address derives from the key in the code, and sends a connection
  request that clinic staff accept on screen. The clinic only accepts visits
  from phones it enrolled, and a health worker only accepts receipts from its
  own clinic.
- **Clinical scoring on the device.** NEWS2 (Royal College of Physicians,
  2017) from respiration, SpO2, oxygen, systolic BP, pulse, consciousness and
  temperature. The clinic recomputes it from the vitals; it never trusts a
  score sent over the wire.
- **Idempotent EHR sync.** Each visit becomes one FHIR transaction: Patient,
  Encounter and eight Observations, each a conditional create on a stable
  identifier. The server, not the phone, refuses a second copy, so the health
  worker's phone and the clinic can both sync the same visit and Medplum keeps
  one.

## Record authority

The EHR is the record of authority. A phone never edits anything there: every
visit is a new Encounter with new Observations, created only if its identifier
is not already present. Offline capture therefore cannot conflict with the
cloud chart; at worst it adds a visit the clinic already had, which the
conditional create turns into a no-op.

## Demo (three phones, about five minutes)

1. **Phone C**, *Clinic hub*, named e.g. "Riverside Clinic". It shows its code.
2. **Phone A**, *Health worker* "Ada": **Scan clinic code**. On C, tap
   **Enroll**. A shows *Enrolled*.
3. **Phone B**, *Health worker* "Ben": enroll the same way.
4. Turn on **airplane mode with Bluetooth on** for all three. No internet from
   here.
5. Walk A out of C's range, with B in between.
6. **A:** **New visit**, choose a patient, tap the **Deteriorating** preset.
   NEWS2 turns red: *Emergency transfer*. **Save**.
7. **C:** the visit appears at the top, *via 1 other phone*. **A:** the visit
   turns *At the clinic*.
8. **B:** *Carried for others* shows the frames it forwarded between Ada and
   Riverside Clinic, and nothing about the patient.
9. **C:** turn off airplane mode. Within 15 seconds the visit shows *In EHR*.
   Open it in Medplum (below).
10. **A:** turn off airplane mode. Its own copy syncs as *In EHR (already
    there)*: the server refused the duplicate.

Without Medplum credentials, steps 1 to 8 work as described and the EHR card
says what is missing.

### Two phones and a Mac

A Mac can stand in for phone B. `tools/relay.py` joins the same mesh through
the SDK's Python bindings as a relay only: it enrolls with no one and prints
each sealed frame it carries, which is the terminal version of B's *Carried for
others* card.

```sh
SDK=~/offline-protocol-sdk tools/relay-app.sh   # needs the SDK's Python venv
tail -f /tmp/cr-relay.log
```

It runs as a small app because macOS kills a process that uses Bluetooth
unless its responsible app declares it, and from a terminal that app is the
terminal. The first run asks for Bluetooth access. Put the Mac between the
two phones, then carry A far enough from C that the clinic phone no longer
appears as A's neighbor (a few rooms; Bluetooth reaches further than you
expect). If the log stops reporting neighbors coming and going while the
phones move, the relay's Bluetooth has stalled: stop it and run the script
again.

## Medplum setup

Hosted Medplum (app.medplum.com) no longer accepts new projects, so the demo
runs Medplum itself, from the images Medplum publishes.

1. Start it (Docker or OrbStack):
   `docker compose -f medplum/docker-compose.yml up -d`.
   The web app is at <http://localhost:3000>.
2. In the web app, **Register**, create a project named *CareRounds*, then
   **Project Admin → Clients → New client**. Copy its ID and secret.
3. `cp src/config.local.example.ts src/config.local.ts` and fill them in, with
   `baseUrl` set to `http://<this Mac's LAN IP>:8103/` (`ipconfig getifaddr en0`)
   so phones on the same Wi-Fi reach it. `config.local.ts` is gitignored. The
   secret is compiled into the app, so this is a demo setup, not a deployment:
   a production gateway would hold the credential server-side.
4. Check the round trip before using phones:
   `MEDPLUM_LIVE=1 npx jest medplum.live` pushes a synthetic visit twice and
   expects *added*, then *duplicate*.
5. In the web app, open **Encounter** and search by identifier
   (`urn:carerounds:visit|<id>`), or open the patient to see the
   Observations on their timeline.

For the demo, "the clinic has internet" means the clinic phone is on the same
Wi-Fi as this Mac. Airplane mode cuts it off exactly as it would cut off the
internet.

## Run

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..
npm start
npm run ios -- --device      # or: npm run android
```

For a demo away from the laptop, install Release builds, which carry their own
JavaScript:

```sh
# iPhone (pass your own team id)
xcodebuild -workspace "$PWD/ios/CareRounds.xcworkspace" -scheme CareRounds \
  -configuration Release -destination 'id=<UDID>' -derivedDataPath /tmp/cr-dd \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=<team id> build
xcrun devicectl device install app --device <UDID> \
  /tmp/cr-dd/Build/Products/Release-iphoneos/CareRounds.app
# Android (signed with the debug key, so reinstalls keep app data)
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a)
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Physical phones only: simulators have no Bluetooth peers. Each phone needs
Bluetooth on; Android asks for Bluetooth and location access, and for the
camera before scanning. iOS asks for Bluetooth and local network access.

Every SDK event is logged with the `[carerounds]` prefix, never with message
content (`adb logcat ReactNativeJS:V '*:S'`; `idevicesyslog -p CareRounds`).

## Checks

```sh
npx tsc --noEmit && npx eslint App.tsx src __tests__ && npx jest
```

The tests cover the NEWS2 bands at every edge, the wire validation, the FHIR
bundle, the Medplum client (against recorded response shapes, not a live
server) and the clinic's and health worker's acceptance rules.

## Files

| File | What it does |
| --- | --- |
| `src/domain/news2.ts` | The NEWS2 chart and what each risk level means for a health worker |
| `src/domain/visit.ts` | Visit records, mesh message validation, the synthetic roster |
| `src/domain/fhir.ts` | Visit to FHIR R4 transaction; reading the outcome |
| `src/services/medplum.ts` | Client-credentials sign-in and the visit push |
| `src/mesh.ts` | The SDK: start, QR enrollment, visits and receipts, relay log, sync loop |
| `src/state.ts` | App state, its pure transitions, persistence |
| `src/ui/` | Welcome, health worker, visit form and clinic screens |

## Limits

- Run on two phones (2026-10-29, iPhone 16 as clinic, Samsung M17 as health
  worker): QR enrollment, a visit delivered directly in about two seconds,
  NEWS2 recomputed at the clinic, the health worker's push *added* and the
  clinic's *already in the EHR*, one Encounter in Medplum. The relay hop
  ran the same day with the Mac standing in for the third phone: the phones
  a few rooms apart with the Mac between them, the visit arrived *via 1 other
  phone*, and the Mac carried five sealed frames in both directions (the
  visit, the receipt and their retransmissions). The phone version of the
  *Carried for others* card has not been run.
- SDK 0.31 workarounds live in `src/mesh.ts`: the connection calls pass an
  empty key package, because the iOS bridge rejects an omitted one.
- NEWS2 is validated for adults, not for children or pregnancy. The roster is
  adults only.
- Visit ids come from `Math.random`, which is fine for a demo but not for
  identifiers that must never collide.
- The clinic accepts enrollment from anyone in Bluetooth range who scanned the
  code, after a tap. A real deployment would check who is enrolling.
- Records are kept in AsyncStorage on the phone, unencrypted at rest. The
  SDK's own store (keys, sessions, queued messages) is protected; the app's
  copy of a visit is not.
- Mesh frames are encrypted, but their sender and recipient addresses are
  visible to every relay, as the *Carried for others* card shows.
