import OfflineProtocol, {
  type ProtocolConfig,
  type ProtocolEvent,
} from '@offline-protocol/mesh-sdk';
import { PermissionsAndroid, Platform } from 'react-native';
import { MEDPLUM_URL } from './config';
import { openEnvelope, signEnvelope } from './domain/envelope';
import { householdBundle, readBundle, visitBundle } from './domain/fhir';
import { panelFor, panelFromSnapshot, parsePanel } from './domain/panel';
import { newId, parseWire, type Visit, type Wire } from './domain/visit';
import {
  fetchSnapshot,
  register,
  syncEnvelopes,
  type SyncResult,
} from './services/medplum';
import {
  acknowledge,
  carry,
  dueForResend,
  getState,
  receive,
  setState,
  settle,
  takePanel,
  type ChartPatient,
  type Rec,
} from './state';

const APP_ID = 'wecare';
const INVITE_PREFIX = 'wecare://enroll?c=';
const SNAPSHOT_MS = 5 * 60_000;
const SYNC_MS = 15_000;
const SYNC_BATCH = 50;

// Bluetooth only. Every phone relays for the others, whatever its battery,
// because a health worker between two others is how a record gets home.
const CONFIG: ProtocolConfig = {
  appId: APP_ID,
  profile: 'default',
  transports: {
    ble: { enabled: true },
    wifiDirect: { enabled: false },
    internet: { enabled: false },
    nostr: { enabled: false },
    reticulum: { enabled: false },
  },
  relay: { allowRelay: true, relayPriority: 'always' },
  group: { relayEnabled: false },
  encryption: { enabled: true, autoKeyExchange: true, storePending: true },
};

// SDK 0.31: the iOS bridge rejects an omitted keyPackage ("'keyPackage' must be
// a byte list") because the TS layer forwards it as null; both bridges read an
// empty list as "none". Without this every Enroll on an iPhone clinic fails.
const NO_KEY_PACKAGE: number[] = [];

let protocol: OfflineProtocol | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let syncing = false;
let lastSyncAt = 0;
let lastSnapshotAt = 0;
let lastEnrollAt = 0;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function mesh(): OfflineProtocol {
  if (!protocol) throw new Error('The mesh is not running');
  return protocol;
}

async function requestPermissions() {
  if (Platform.OS !== 'android') return;
  const P = PermissionsAndroid.PERMISSIONS;
  const wanted =
    Number(Platform.Version) >= 31
      ? [
          P.BLUETOOTH_SCAN,
          P.BLUETOOTH_ADVERTISE,
          P.BLUETOOTH_CONNECT,
          P.ACCESS_FINE_LOCATION,
        ]
      : [P.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  if (Object.values(result).some(r => r !== 'granted')) {
    throw new Error(
      'WeCare needs Bluetooth and location access to reach nearby phones.',
    );
  }
}

export async function start() {
  if (protocol) return;
  setState(s => ({ ...s, status: 'starting', error: '' }));
  try {
    await requestPermissions();
    const p = new OfflineProtocol(CONFIG);
    p.on('all', onEvent);
    protocol = p;
    await p.start();
    if (!(await p.isMlsInitialized())) await p.initializeMlsWithSecureStorage();
    let address = await p.localAddress();
    for (let i = 0; !address && i < 30; i++) {
      await pause(500);
      address = await p.localAddress();
    }
    if (!address)
      throw new Error('The mesh identity did not come up. Reopen the app.');
    if (!(await p.isBluetoothEnabled())) {
      await p.requestEnableBluetooth().catch(() => false);
    }
    setState(s => ({ ...s, status: 'on', address }));
    ticker = setInterval(tick, 5_000);
    tick();
  } catch (e) {
    await stop();
    setState(s => ({ ...s, status: 'error', error: message(e) }));
  }
}

export async function stop() {
  if (ticker) clearInterval(ticker);
  ticker = null;
  const p = protocol;
  protocol = null;
  if (p) {
    await p.stop().catch(() => {});
    await p.destroy().catch(() => {});
  }
  setState(s => ({ ...s, status: 'off', neighbors: [] }));
}

// --- events ---

// Event trace for device runs: logcat tag ReactNativeJS, iOS syslog.
const QUIET = new Set([
  'network_metrics',
  'dors_score_updated',
  'convergence_diag',
]);

function onEvent(e: ProtocolEvent) {
  if (!QUIET.has(e.type)) {
    // Never the content: records carry patient data, and logs leave the app.
    const meta = JSON.stringify({ ...e, content: undefined });
    console.log('[wecare]', e.type, meta.slice(0, 300));
  }
  const s = getState();
  switch (e.type) {
    case 'neighbor_discovered':
      if (!s.neighbors.includes(e.peer_id)) {
        setState(x => ({ ...x, neighbors: [...x.neighbors, e.peer_id] }));
      }
      break;
    case 'neighbor_lost':
      setState(x => ({
        ...x,
        neighbors: x.neighbors.filter(n => n !== e.peer_id),
      }));
      break;
    case 'connection_request_received': {
      if (s.role !== 'clinic') return;
      const peer = {
        address: e.sender,
        name: e.sender_name.slice(0, 40) || 'Health worker',
      };
      if (s.workers.some(w => w.address === peer.address)) {
        accept(peer.address); // a worker re-enrolling (new install, lost answer)
      } else if (!s.requests.some(r => r.address === peer.address)) {
        setState(x => ({ ...x, requests: [...x.requests, peer] }));
      }
      break;
    }
    case 'connection_accepted':
      if (s.role === 'chw' && e.accepted_by === s.clinic?.address) {
        setState(x => ({ ...x, enrolled: true }));
        tick();
      }
      break;
    case 'message_received': {
      // The SDK refuses plaintext by default; this keeps the app honest if that ever changes.
      if ((e as { encrypted?: boolean }).encrypted === false) return;
      const wire = parseWire(e.content);
      if (wire) onWire(e.sender, wire, e.hop_count);
      break;
    }
    case 'message_relayed':
      setState(x =>
        carry(x, {
          id: e.message_id,
          from: e.sender,
          to: e.recipient,
          hops: e.hop_count,
          at: Date.now(),
        }),
      );
      break;
  }
}

async function onWire(from: string, wire: Wire, hops: number) {
  const s = getState();
  if (s.role === 'chw' && from === s.clinic?.address) {
    if (wire.t === 'ack') {
      setState(x => acknowledge(x, from, wire.id, wire.synced, wire.reason));
    }
    if (wire.t === 'panel') {
      const panel = parsePanel(wire.panel);
      if (panel) setState(x => takePanel(x, panel));
    }
  }
  if (wire.t === 'env' && s.role === 'clinic' && protocol) {
    if (!s.workers.some(w => w.address === from)) return; // not enrolled here
    // The sender's own key must have signed it, byte for byte.
    const body = await openEnvelope(protocol, wire.env, from);
    if (!body) return;
    const rec: Rec = {
      id: body.id,
      env: wire.env,
      ...readBundle(body.bundle),
      synced: 'pending',
    };
    setState(x => receive(x, from, rec, hops, Date.now()));
    // Acknowledge repeats too (the first ack may be lost), with Medplum's answer once there is one.
    const known = getState().received.find(r => r.id === body.id);
    send(from, {
      t: 'ack',
      id: body.id,
      ...(known && known.synced !== 'pending' && { synced: known.synced }),
    });
  }
}

function send(to: string, wire: Wire) {
  protocol
    ?.sendMessage({ recipient: to, content: JSON.stringify(wire) })
    .catch(e => console.warn('[wecare] send failed', message(e)));
}

/** Clinic: gives a worker the part of its panel that is theirs, sealed for them alone. */
function sendPanel(address: string) {
  const { panel, role } = getState();
  if (role !== 'clinic' || !panel) return;
  const theirs = panelFor(panel, address);
  if (theirs) send(address, { t: 'panel', panel: theirs });
}

// --- the periodic work: enrollment retries, resends, sync ---

function tick() {
  const s = getState();
  const now = Date.now();
  if (s.role === 'chw' && s.clinic && protocol) {
    if (!s.enrolled && now - lastEnrollAt > 20_000) {
      lastEnrollAt = now;
      protocol
        .sendConnectionRequest({
          recipient: s.clinic.address,
          senderName: s.name,
          keyPackage: NO_KEY_PACKAGE,
        })
        .catch(e => console.warn('[wecare] enroll failed', message(e)));
    }
    if (s.enrolled) {
      const due = dueForResend(s, now);
      due.forEach(x => send(s.clinic!.address, { t: 'env', env: x.env }));
      if (due.length) {
        const ids = new Set(due.map(x => x.id));
        setState(x => ({
          ...x,
          sent: x.sent.map(v =>
            ids.has(v.id) ? { ...v, lastSentAt: now } : v,
          ),
        }));
      }
    }
  }
  if (MEDPLUM_URL && s.practitioner && now - lastSyncAt > SYNC_MS) {
    if (pending().length || now - lastSnapshotAt > SNAPSHOT_MS) sync();
  }
}

// --- actions ---

export async function inviteCode(): Promise<string> {
  return (
    INVITE_PREFIX + (await mesh().createInvite(getState().name.slice(0, 40)))
  );
}

export async function enroll(scanned: string) {
  if (!scanned.startsWith(INVITE_PREFIX))
    throw new Error('That is not a WeCare clinic code.');
  // Throws on a forged or damaged code: the address must derive from the key it carries.
  const invite = await mesh().parseInvite(scanned.slice(INVITE_PREFIX.length));
  setState(s => ({
    ...s,
    clinic: { address: invite.address, name: invite.petname || 'Clinic' },
    enrolled: false,
  }));
  lastEnrollAt = 0;
  tick();
}

export function accept(address: string) {
  const s = getState();
  const peer =
    s.requests.find(r => r.address === address) ??
    s.workers.find(w => w.address === address);
  if (!peer || !protocol) return;
  protocol
    .acceptConnectionRequest({
      recipient: address,
      accepterName: s.name,
      keyPackage: NO_KEY_PACKAGE,
    })
    .catch(e => console.warn('[wecare] accept failed', message(e)));
  setState(x => ({
    ...x,
    requests: x.requests.filter(r => r.address !== address),
    workers: x.workers.some(w => w.address === address)
      ? x.workers
      : [...x.workers, peer],
  }));
  // Give the encrypted session a moment before the first message on it.
  setTimeout(() => sendPanel(address), 5_000);
}

export function decline(address: string) {
  protocol?.rejectConnectionRequest({ recipient: address }).catch(() => {});
  setState(x => ({
    ...x,
    requests: x.requests.filter(r => r.address !== address),
  }));
}

/** Signs a record now, at the bedside; every hop after this carries it untouched. */
async function keep(bundle: unknown) {
  const id = newId();
  const env = await signEnvelope(mesh(), id, bundle);
  // lastSentAt 0: the next tick sends it if the phone is enrolled.
  setState(s => ({
    ...s,
    sent: [
      {
        id,
        env,
        ...readBundle(bundle),
        synced: 'pending',
        lastSentAt: 0,
        delivered: false,
      },
      ...s.sent,
    ],
  }));
  tick();
}

export const record = (visit: Visit) =>
  keep(visitBundle(visit, getState().practitioner));

export const editHousehold = (p: ChartPatient, household: string) =>
  keep(householdBundle(p.resource, household));

/** Lets a record go: "use the EHR's" on a conflict, or dismissing one at the clinic. */
export function drop(id: string) {
  setState(s => ({
    ...s,
    sent: s.sent.filter(x => x.id !== id),
    received: s.received.filter(x => x.id !== id),
  }));
}

/** "Keep mine" on a conflict: the same change again, on the version Medplum has now. */
export async function keepMine(p: ChartPatient) {
  const edit = p.edit;
  if (!edit?.edit) return;
  drop(edit.id);
  await editHousehold(p, edit.edit.household);
}

export async function signIn(email: string, password: string) {
  if (!MEDPLUM_URL)
    throw new Error('No Medplum server in this build (see README).');
  const practitioner = await register(
    MEDPLUM_URL,
    mesh(),
    email.trim(),
    password,
  );
  setState(s => ({ ...s, practitioner, syncNote: '' }));
  lastSnapshotAt = 0;
  sync();
}

function pending(): Rec[] {
  const s = getState();
  const list: Rec[] = s.role === 'clinic' ? s.received : s.sent;
  return list.filter(x => x.synced === 'pending');
}

function summary(results: SyncResult[]): string {
  const count = (k: SyncResult['status']) =>
    results.filter(r => r.status === k).length;
  const refused = results.find(r => r.status === 'rejected');
  return [
    count('applied') && `${count('applied')} added`,
    count('duplicate') && `${count('duplicate')} already there`,
    count('conflict') && `${count('conflict')} changed in the EHR meanwhile`,
    refused && `${count('rejected')} refused (${refused.reason})`,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Pushes signed records to Medplum, then refreshes the snapshot. A failure stops the run; the next tick retries. */
export async function sync() {
  if (syncing) return;
  const s = getState();
  if (!MEDPLUM_URL || !s.practitioner) {
    setState(x => ({
      ...x,
      syncNote: MEDPLUM_URL
        ? 'Sign in to Medplum once to register this phone.'
        : 'No Medplum server in this build (see README).',
    }));
    return;
  }
  syncing = true;
  lastSyncAt = Date.now();
  try {
    const batch = pending().slice(0, SYNC_BATCH);
    if (batch.length) {
      const results = await syncEnvelopes(
        MEDPLUM_URL,
        batch.map(r => r.env),
      );
      setState(x => ({
        ...settle(x, results),
        syncNote: `Medplum: ${summary(results)}`,
      }));
      if (s.role === 'clinic') {
        // Tell each worker what Medplum said, so phones that never get signal hear it too.
        for (const r of results) {
          const rec = s.received.find(x => x.id === r.id);
          const synced = r.status === 'applied' ? 'added' : r.status;
          if (rec)
            send(rec.from, { t: 'ack', id: rec.id, synced, reason: r.reason });
        }
      }
    }
    if (Date.now() - lastSnapshotAt > SNAPSHOT_MS || batch.length) {
      const panel = panelFromSnapshot(await fetchSnapshot(MEDPLUM_URL, mesh()));
      lastSnapshotAt = Date.now();
      setState(x => takePanel(x, panel));
      if (s.role === 'clinic')
        getState().workers.forEach(w => sendPanel(w.address));
    }
  } catch (e) {
    const offline = e instanceof TypeError; // fetch's network failure
    setState(x => ({
      ...x,
      syncNote: offline ? 'No internet. Will retry on its own.' : message(e),
    }));
  } finally {
    syncing = false;
  }
}

export async function resetDemo() {
  await stop();
  setState(s => ({
    ...s,
    role: null,
    clinic: null,
    enrolled: false,
    practitioner: null,
    panel: null,
    sent: [],
    workers: [],
    requests: [],
    received: [],
    carried: [],
    syncNote: '',
  }));
}
