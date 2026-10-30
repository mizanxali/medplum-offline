<p align="center"><img src="wecare/ios/WeCare/Images.xcassets/AppIcon.appiconset/icon-1024.png" width="96" alt="WeCare app icon"></p>
<h1 align="center">Medplum × Offline Protocol</h1>
<p align="center"><b>The EHR, on the phones of people who work where there is no signal</b></p>

This repository is a fork of [Medplum](https://github.com/medplum/medplum) 5.2, the open-source, FHIR-native EHR
platform, with the **Offline Protocol SDK** brought into it. Community health workers visiting households far from
the clinic keep working with no signal: they open their patients' charts, record visits and correct records on their
phones. Every change is signed on the phone that made it and travels to the clinic over an encrypted Bluetooth mesh,
through other health workers' phones if it has to. When any phone holding it gets online, it lands in Medplum exactly
once, under the right author, with Medplum's own access policies deciding what is allowed.

The app is WeCare, in [`wecare/`](wecare/README.md). The server half lives in the Medplum server as three endpoints
under `/offline`; the rest of Medplum is unchanged.

## How it works

Every change made on a phone becomes a **signed record**: one FHIR R4 transaction, wrapped with an id and a time and
signed by the phone's Ed25519 identity key, the same key its mesh address comes from. The phone keeps it, sends it to
the clinic over the mesh, and shows it on the patient's chart straight away. Medplum applies it when any phone uploads
it, as the practitioner who owns that key.

```
 Health worker's phone                 other phones         Clinic hub phone                     Medplum
 chart offline, record, sign ─▶ store ─▶ BLE relay ══▶ verify ─▶ re-score ─▶ store
                                          (MLS 1:1)           │
        └──────────── when online: POST /offline/sync ────────┴──▶ verify signature, find practitioner,
                                                                    apply as them, record Provenance
        ◀──────────── panel over the mesh ◀── GET /offline/snapshot ◀── their patients, as their policy allows
```

The SDK provides the transport and the identity: BLE discovery and links, MLS-encrypted 1:1 messages, relaying
through phones that can't read what they carry, store and forward, and a per-device Ed25519 key. Medplum provides the
record: FHIR resources, versions, access policies and Provenance. The fork adds the part in between: who a phone
belongs to, what a signed record means, and how it reaches Medplum.

## Offline Protocol SDK integration

| Need | SDK |
|---|---|
| A mesh with no infrastructure | `ProtocolConfig` with only the `ble` transport enabled |
| Every phone helps carry records | `relay: { allowRelay: true, relayPriority: 'always' }` |
| End-to-end encryption between enrolled phones | `initializeMlsWithSecureStorage()` and `encryption: { enabled, autoKeyExchange, storePending }` |
| A phone identity Medplum can check | `getIdentityPublicKey()`; the `off1…` address is derived from that key, so the server checks the binding without trusting the phone |
| Records signed by their author | `signData()` over the record's exact bytes |
| Checking a record on another phone | `deriveAddress()` to tie the attached key to the sender, then `verifySignature()` |
| Enrollment at the clinic | `createInvite()` and `parseInvite()` behind a QR code, then `sendConnectionRequest()`, `acceptConnectionRequest()` and `connection_accepted` |
| Records, receipts and panels between phones | `sendMessage()` (MLS 1:1) and `message_received`, with `hop_count` to show how a record travelled |
| Store, forward and relay | the SDK outbox and relay; `message_relayed` shows a phone what it carried for others, never the content |
| Who is around | `neighbor_discovered` and `neighbor_lost` |

## Medplum integration

### Device identity
- A phone's SDK address is self-certifying: bech32m with prefix `off` over `0x01 || SHA-256(public key)[0:20]`. The
  server derives it from the key itself.
- A device belongs to the Practitioner who carries it, as a `Practitioner.identifier` with system
  `urn:offline-protocol:address`. One practitioner can have several phones. Revoking a phone means removing the
  identifier, from the Medplum app like any other edit.
- `POST /offline/devices` is the only endpoint that needs a Medplum sign-in. The phone signs in once (password,
  PKCE), proves it holds the key by signing `offline-device-registration|Practitioner/<id>`, and the server binds the
  address. Only Practitioners can register; an address already bound to someone else is refused with 409. The phone
  keeps no password and no token afterwards.

### Signed records, applied exactly once
`POST /offline/sync` takes up to 50 envelopes and needs no bearer token: the signature is the authentication, so any
phone, including the clinic hub or a relay, can hand in records it could not have forged.

```ts
type Envelope = { body: string; sig: string; key: string };
// body = JSON.stringify({ id, created, bundle })  bundle: a FHIR R4 transaction
// sig  = base64 Ed25519 over the UTF-8 bytes of body; key = base64 public key
```

For each envelope the server:
1. checks the signature over `body` exactly as received, derives the address from `key`, and finds the
   Practitioner bound to it and their active ProjectMembership;
2. accepts only what merges safely: conditional creates (`ifNoneExist`) and versioned updates (`PUT` with `ifMatch`);
   deletes, patches and anything else are refused;
3. runs the transaction through Medplum's own batch processor **as that member**, under their access policy and
   rate limits, so `meta.author` is the practitioner and a policy denial is a denial;
4. appends a **Provenance** to the same transaction, so the writes and their record commit together or not at all.
   It targets every written resource, names the practitioner and the phone as agents, and keeps the device's
   signature, the signed body and the key. Its tag `urn:offline-protocol:envelope|<address>/<id>` is checked before
   applying and on any failure, so a second copy, even one racing the first, comes back as a duplicate.

| Result | Meaning | On the phone |
|---|---|---|
| `applied` | written, with its Provenance | *In EHR* |
| `duplicate` | an earlier copy was applied | *In EHR, already there* |
| `conflict` | an edit was made on a version the EHR has since moved past; nothing was written | shown to the user: **Keep mine** or **Use the EHR's** |
| `rejected` | `bad_envelope`, `bad_signature`, `unknown_device`, `bad_bundle`, `forbidden` or Medplum's own validation reason | dropped |

### The offline snapshot
`GET /offline/snapshot` is signed too: the phone signs `offline-snapshot|<time>`, and the server refuses a time more
than five minutes off. It returns, as the practitioner's access policy allows:
- their panel: the Patients whose `generalPractitioner` includes them, with `meta.versionId` so edits can carry
  `ifMatch`, and the Practitioners on those panels with their phone addresses;
- each patient's active Conditions, AllergyIntolerances and MedicationStatements;
- each patient's last three Encounters with their vital signs and NEWS2 Observations and the visit note.

The panel is `Patient.generalPractitioner` rather than a CareTeam: it is the field FHIR already has for who looks
after a patient, it needs one search, and the same reference drives the access policy
(`Patient?general-practitioner=%profile`). The clinic is a practitioner on every patient's panel, so its snapshot
covers the whole practice, and it uses the practitioners' addresses to give each enrolled health worker their own part
over the mesh. Workers who never get signal still get fresh charts.

### What a visit becomes
An **Encounter** (class *home health*), a **vital signs Observation** whose components are the seven NEWS2 inputs
with their LOINC codes, a **NEWS2 Observation** derived from it, and the note as a **DocumentReference** (LOINC
*progress note*), each conditional on a stable identifier. A household correction is a `PUT` of the Patient with the
version the phone saw.

## Features

- **The chart offline:** problems, allergies, medicines, recent visits and the last early-warning score for each of a
  health worker's patients, on their phone, from the clinic over the mesh or straight from Medplum.
- **Visits and notes with no signal:** vitals, an on-device NEWS2 score and next step, and a free-text note, signed
  at the bedside.
- **Edits that never overwrite:** a household correction applies only on the version the phone saw; otherwise both
  values are shown and a person decides.
- **A merged view:** every phone lays its own unsynced records over the last snapshot, so a chart is current on the
  phone that changed it, and each unsynced item says so.
- **No secrets on phones:** one sign-in registers the phone's key; after that the phone signs, and Medplum checks.
- **Any phone can carry it home:** records relay through phones that can't read them, and whichever phone gets online
  first uploads, without being able to change a byte.
- **Exactly once, under the right name:** every record lands once, authored by the practitioner whose phone signed it,
  with a Provenance holding that signature.
- **Medplum's rules still apply:** each record runs under the author's access policy; a health worker reads and writes
  only their own patients.
- **Triage at the clinic:** the hub verifies each record against its sender's key, re-scores NEWS2 itself and lists
  visits sickest first.
- **Answers travel back:** the hub tells each health worker how their records landed in Medplum, over the mesh.

## License

Apache 2.0, as Medplum. See [LICENSE.txt](LICENSE.txt).
