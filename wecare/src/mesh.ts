import OfflineProtocol, {
  type ProtocolConfig,
  type ProtocolEvent,
} from '@offline-protocol/mesh-sdk';
import { PermissionsAndroid, Platform } from 'react-native';
import { MEDPLUM } from './config';
import { parseWire, type Visit, type Wire } from './domain/visit';
import { pushVisit } from './services/medplum';
import {
  acknowledge,
  carry,
  dueForResend,
  getState,
  receiveVisit,
  setState,
  type Synced,
} from './state';

const APP_ID = 'carerounds';
const INVITE_PREFIX = 'carerounds://enroll?c=';

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

let protocol: OfflineProtocol | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let syncing = false;
let lastSyncAt = 0;
let lastEnrollAt = 0;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

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
      'CareRounds needs Bluetooth and location access to reach nearby phones.',
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

function onEvent(e: ProtocolEvent) {
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

function onWire(from: string, wire: Wire, hops: number) {
  const s = getState();
  if (wire.t === 'ack' && s.role === 'chw') {
    setState(x => acknowledge(x, from, wire.id));
  }
  if (wire.t === 'visit' && s.role === 'clinic') {
    if (!s.workers.some(w => w.address === from)) return; // not enrolled here
    setState(x => receiveVisit(x, from, wire.visit, hops, Date.now()));
    send(from, { t: 'ack', id: wire.visit.id }); // acknowledge repeats too: the first ack may be lost
  }
}

function send(to: string, wire: Wire) {
  protocol
    ?.sendMessage({ recipient: to, content: JSON.stringify(wire) })
    .catch(e => console.warn('[carerounds] send failed', message(e)));
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
        })
        .catch(e => console.warn('[carerounds] enroll failed', message(e)));
    }
    if (s.enrolled) {
      const due = dueForResend(s, now);
      due.forEach(x => send(s.clinic!.address, { t: 'visit', visit: x.visit }));
      if (due.length) {
        const ids = new Set(due.map(x => x.visit.id));
        setState(x => ({
          ...x,
          sent: x.sent.map(v =>
            ids.has(v.visit.id) ? { ...v, lastSentAt: now } : v,
          ),
        }));
      }
    }
  }
  if (MEDPLUM && now - lastSyncAt > 15_000 && pending().length) sync();
}

// --- actions ---

export async function inviteCode(): Promise<string> {
  if (!protocol) throw new Error('The mesh is not running');
  return (
    INVITE_PREFIX + (await protocol.createInvite(getState().name.slice(0, 40)))
  );
}

export async function enroll(scanned: string) {
  if (!protocol) throw new Error('The mesh is not running');
  if (!scanned.startsWith(INVITE_PREFIX))
    throw new Error('That is not a CareRounds clinic code.');
  // Throws on a forged or damaged code: the address must derive from the key it carries.
  const invite = await protocol.parseInvite(
    scanned.slice(INVITE_PREFIX.length),
  );
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
    .acceptConnectionRequest({ recipient: address, accepterName: s.name })
    .catch(e => console.warn('[carerounds] accept failed', message(e)));
  setState(x => ({
    ...x,
    requests: x.requests.filter(r => r.address !== address),
    workers: x.workers.some(w => w.address === address)
      ? x.workers
      : [...x.workers, peer],
  }));
}

export function decline(address: string) {
  protocol?.rejectConnectionRequest({ recipient: address }).catch(() => {});
  setState(x => ({
    ...x,
    requests: x.requests.filter(r => r.address !== address),
  }));
}

export function record(visit: Visit) {
  // lastSentAt 0: the next tick sends it if the phone is enrolled.
  setState(s => ({
    ...s,
    sent: [
      { visit, lastSentAt: 0, delivered: false, synced: 'pending' as Synced },
      ...s.sent,
    ],
  }));
  tick();
}

function pending(): Visit[] {
  const s = getState();
  const list = s.role === 'clinic' ? s.received : s.sent;
  return list.filter(x => x.synced === 'pending').map(x => x.visit);
}

function markSynced(id: string, synced: Synced) {
  setState(s => ({
    ...s,
    sent: s.sent.map(x => (x.visit.id === id ? { ...x, synced } : x)),
    received: s.received.map(x => (x.visit.id === id ? { ...x, synced } : x)),
  }));
}

/** Pushes every pending visit to Medplum. A failure stops the run; the next one retries. */
export async function sync() {
  if (syncing) return;
  if (!MEDPLUM) {
    setState(s => ({
      ...s,
      syncNote: 'No Medplum credentials in this build (see README).',
    }));
    return;
  }
  syncing = true;
  lastSyncAt = Date.now();
  let added = 0;
  let duplicate = 0;
  try {
    for (const visit of pending()) {
      const outcome = await pushVisit(MEDPLUM, visit);
      markSynced(visit.id, outcome);
      if (outcome === 'added') added++;
      else duplicate++;
    }
    const parts = [
      added && `${added} added`,
      duplicate && `${duplicate} already in the EHR`,
    ].filter(Boolean);
    setState(s => ({
      ...s,
      syncNote: parts.length ? `Medplum: ${parts.join(', ')}` : s.syncNote,
    }));
  } catch (e) {
    const offline = e instanceof TypeError; // fetch's network failure
    setState(s => ({
      ...s,
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
    sent: [],
    workers: [],
    requests: [],
    received: [],
    carried: [],
    syncNote: '',
  }));
}
