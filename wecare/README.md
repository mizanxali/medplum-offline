<p align="center"><img src="ios/WeCare/Images.xcassets/AppIcon.appiconset/icon-1024.png" alt="WeCare app icon" width="128"></p>

# WeCare

WeCare is a mobile app for community health workers who visit patients at
home, often where there is no signal. It carries the part of the clinic's EHR
they need: their patients' charts and recent visits come with them, a visit
recorded at the bedside is signed on the phone, and the visit reaches the
clinic on its own: over Bluetooth, end-to-end encrypted, hopping through other
health workers' phones if it has to. When any phone holding it gets online,
it lands in the clinic's Medplum exactly once, under the health worker's name.
It's built on the
[Offline Protocol SDK](https://www.npmjs.com/package/@offline-protocol/mesh-sdk)
and lives in this fork of Medplum, whose server half is described in the
[repository README](../README.md).

React Native 0.88, `@offline-protocol/mesh-sdk` 0.31, Medplum 5.2. Every
patient and health worker is synthetic.

## What it is

Community health workers visit households far from the clinic. Where there is
no mobile signal, a visit usually means paper, a late report, and a patient who
is getting worse without anyone at the clinic knowing. WeCare closes that gap
with phones alone: no towers, no Wi-Fi, no server in the field.

One app, two roles:

- **Health worker.** Opens a patient's chart offline (problems, allergies,
  medicines, recent visits and the last early-warning score), records a visit
  with a note, sees the score and a next step at once, and corrects a
  household when a family moves. Everything leaves for the clinic on its own.
- **Clinic hub.** A phone at the clinic, signed in as the clinic. It enrolls
  health workers, gives each of them their own patients over the mesh,
  receives their visits sickest first, and passes everything to Medplum.

Any phone running WeCare also carries sealed records for others, so a health
worker walking between a colleague and the clinic becomes part of the route.

## How it works

```
 Health worker's phone             other WeCare phones           Clinic hub phone               Medplum
 (no signal)                       (carry it, can't read it)     (online when it can be)
 chart, visit, NEWS2, sign  -->    Bluetooth mesh, any hops  --> verify, re-score, triage  -->  /offline/sync
                            <--    receipt, panel, same way  <-- /offline/snapshot         <--
```

1. **Sign in once.** With signal, each phone signs in to Medplum one time.
   That registers the phone's own key with the user's Practitioner; the
   password and the token are thrown away straight after. From then on the
   phone proves who it is by signing.
2. **Enroll once, by QR.** The clinic hub shows a code that carries its
   address and public key. The health worker scans it near the clinic, and
   staff tap **Enroll**. From then on the two phones share an end-to-end
   encrypted session.
3. **Patients travel with the worker.** When the hub is online it fetches its
   offline snapshot from Medplum and sends each enrolled worker the part that
   is theirs: their patients, each one's chart, and the last three visits.
   A worker's phone that finds signal fetches its own.
4. **Record offline.** The health worker opens a patient and steps in the
   vitals. The phone computes NEWS2 (Royal College of Physicians, 2017) and
   shows the next step, from *Routine follow-up* to *Emergency transfer*. On
   save, the phone builds the FHIR transaction and signs it with its key, at
   the bedside. The visit shows on the patient's chart at once, marked *Not in
   the EHR yet*.
5. **Carry it home.** The signed record goes to the clinic as one encrypted
   1:1 message over Bluetooth. If the clinic is out of range, the mesh hands it
   to nearby WeCare phones, which forward it without being able to read it.
   The phone resends every 30 seconds until the clinic's receipt comes back.
6. **Triage at the clinic.** The hub accepts records only from phones it
   enrolled, and only if the sender's own key signed them, byte for byte. It
   reads the visit out of the signed bundle, recomputes the score itself and
   lists visits sickest first.
7. **Into the EHR.** Whichever phone holding a record gets online first (the
   hub or the health worker's) hands it to Medplum, untouched. Medplum checks
   the signature, applies it as the health worker, keeps exactly one copy, and
   says so: the hub passes that answer back to the worker over the mesh.

## Offline Protocol SDK integration

Everything between phones goes through the SDK; the app never touches
Bluetooth itself. Nearly all of it lives in `src/mesh.ts`.

| Need | SDK |
|------|-----|
| A mesh with no infrastructure | `ProtocolConfig` with only the `ble` transport enabled (internet, Wi-Fi Direct, Nostr and Reticulum off) |
| Every phone helps carry records | `relay: { allowRelay: true, relayPriority: 'always' }`, so a phone relays whatever its battery |
| Identity and encryption | `initializeMlsWithSecureStorage()`, `localAddress()`, and `encryption: { enabled, autoKeyExchange, storePending }` |
| Records signed by their author | `signData()` over the record's exact bytes, `getIdentityPublicKey()` to attach the key, the same Ed25519 identity that makes the phone's address |
| Checking a record on arrival | `deriveAddress()` to tie the attached key to the sender, then `verifySignature()` |
| Enrollment by QR | `createInvite()` on the hub; `parseInvite()` on the health worker's phone, which rejects a code whose address doesn't derive from its key |
| Clinic approval | `sendConnectionRequest()`, the `connection_request_received` event, then `acceptConnectionRequest()` or `rejectConnectionRequest()`, and `connection_accepted` |
| Records, receipts and panels | `sendMessage()` for MLS-encrypted 1:1 messages; `message_received` with `hop_count`, shown at the clinic as *direct* or *via N other phones* |
| Store and forward | the SDK queues and retries undelivered messages and hands them to neighbors when the recipient is out of reach; the app adds its own receipt and resend on top, so "at the clinic" means the clinic confirmed it |
| Showing the relay | `message_relayed` drives *Carried for others*: sender, recipient and hop count only, never content |
| Who is around | `neighbor_discovered` and `neighbor_lost` drive "Mesh on · N nearby · no internet needed" |

Trust is kept at the edges: the clinic drops anything from a phone it didn't
enroll or that its sender didn't sign, every message is parsed as untrusted
input, a panel is checked field by field before the screen sees it, and logs
never contain message content.

## EHR integration

The EHR is [Medplum](https://www.medplum.com), an open-source, FHIR-native EHR
platform. This fork adds three endpoints to its server, and the app talks only
to those: `src/domain/fhir.ts`, `src/domain/panel.ts` and
`src/services/medplum.ts`.

- **No secret on the phone.** The app holds the server's address and nothing
  else. A one-time sign-in binds the phone's key to the user's Practitioner
  (`POST /offline/devices`); after that, the phone's signature is its
  credential, for writing and for reading.
- **A FHIR transaction per record.** A visit is one bundle: an **Encounter**
  (class *home health*, the health worker as participant), a **vital signs
  Observation** whose components are respiratory rate, oxygen saturation,
  systolic blood pressure, heart rate and temperature with their LOINC codes,
  supplemental oxygen and level of consciousness (ACVPU), a **NEWS2
  Observation** derived from it, and the visit note as a **DocumentReference**
  (LOINC *progress note*). A household correction is a `PUT` of the Patient.
- **Signed once, carried untouched.** The phone signs `{ id, created, bundle }`
  as a string the moment the record is made. Every hop, and Medplum, checks
  that exact string.
- **Exactly once.** Creates are conditional on stable identifiers
  (`urn:wecare:visit`, `urn:wecare:observation`, `urn:wecare:note`), and
  Medplum records each applied record as a Provenance holding the signature.
  However many phones send it, the first applies and the rest come back as
  *already there*.
- **Never over a newer change.** An edit carries the Patient version the phone
  last saw (`ifMatch`). If the EHR changed meanwhile, it comes back as a
  conflict and nothing is overwritten; the patient screen shows both values
  and offers **Keep mine** (the same change, on the EHR's new version) or
  **Use the EHR's**.
- **Medplum decides.** Each record is applied under the health worker's own
  access policy. A worker sees and writes only the patients on their panel.
- **The panel.** `GET /offline/snapshot`, signed by the phone, returns the
  practitioner's patients with their active problems, allergies and medicines,
  and the last three visits each with their vitals, score and note. The phone
  keeps it, and lays its own unsynced records over it, so a chart is always
  current on the phone that changed it.

## Features demoed

- **Phone setup with no account:** pick a role, type a name, and the mesh
  starts with no internet.
- **One sign-in, then none:** the phone registers its key with the
  practitioner, and keeps no password or token.
- **QR enrollment with clinic approval:** the code carries a key, not a
  password, and someone at the clinic taps **Enroll**.
- **The chart offline:** each patient's problems, allergies, medicines, recent
  visits and last score, from the clinic over the mesh or from Medplum.
- **Offline visit capture:** vitals steppers, quick presets, each reading's
  contribution to the score, and a free-text note.
- **On-device NEWS2:** the score and the next step update as each vital
  changes.
- **Signed at the bedside:** every record is signed by the phone that made
  it; the clinic and Medplum both refuse one whose bytes changed.
- **Multi-hop sealed relay:** a record reaches the clinic *via 1 other phone*,
  which shows it carried something it couldn't read, and the receipt returns
  the same way.
- **Clinic triage:** visits sorted by risk, re-scored at the clinic, accepted
  only from enrolled phones that signed them.
- **Into Medplum exactly once, as the health worker:** the first copy is
  applied under her name with a Provenance holding her signature; every later
  copy is *already there*.
- **Conflicts a person settles:** an edit made on an old version is never
  applied over a newer one.
- **What the EHR said, without signal:** the hub tells each worker how their
  records landed.

## A walk through it

Stills from the launch video (`video/`, built in Remotion from the app's own
screens). The patients and health workers are the app's synthetic demo data.

![Set up a phone](docs/video/1-setup.jpg)
![Enroll with a scan](docs/video/2-enroll.jpg)
![Ada's phone enrolled at Riverside Clinic](docs/video/3-enroll-phones.jpg)
![Record the visit](docs/video/4-record.jpg)
![The score, on the spot](docs/video/5-score.jpg)
![Carried by the next phone](docs/video/6-carried.jpg)
![Ruth's visit reaching the clinic through Ben's phone](docs/video/7-carried-phones.jpg)
![Into the real EHR](docs/video/8-ehr.jpg)
![The visit in the EHR on the clinic's phone, and Ada's copy already there](docs/video/9-ehr-phones.jpg)
