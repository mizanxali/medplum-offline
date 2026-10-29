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

Physical phones only: simulators have no Bluetooth peers. Each phone needs
Bluetooth on; Android asks for Bluetooth and location access, and for the
camera before scanning.

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

- Not yet run on phones. The Medplum sync is verified against a self-hosted
  Medplum 5.2 (`medplum.live` test), not against a phone build.
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
