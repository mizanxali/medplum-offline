#!/usr/bin/env python3
"""A Mac as the third phone: joins the CareRounds Bluetooth mesh as a relay only.

It forwards sealed frames between the health worker and the clinic and prints
each one it carries. It enrolls with no one and cannot read what it carries:
visits are MLS-encrypted for the clinic alone.

Run with the SDK's Python bindings (see README, "Relay without a third phone"):
    <sdk>/bindings/python/.venv/bin/python tools/relay.py
"""

import asyncio
import signal
import tempfile
import time
from pathlib import Path

from offline_protocol_sdk import ProtocolManager
from offline_protocol_sdk.offline_protocol import (
    OverflowPolicy,
    ProtocolConfig,
    RelayConfig,
    RelayPriority,
)

seen: set[str] = set()
neighbors: set[str] = set()


def short(address: str) -> str:
    return f"{address[:8]}…{address[-4:]}" if address else "?"


def on_event(e: dict) -> None:
    t = e.get("type")
    now = time.strftime("%H:%M:%S")
    if t == "message_relayed" and e.get("message_id") not in seen:
        seen.add(e["message_id"])
        print(
            f"{now}  carried sealed frame {len(seen):>3}: "
            f"{short(e.get('sender', ''))} -> {short(e.get('recipient', ''))}  "
            f"(hop {e.get('hop_count')}, contents unreadable here)",
            flush=True,
        )
    elif t in ("neighbor_discovered", "neighbor_lost"):
        peer = e.get("peer_id", "")
        # The SDK re-reports a neighbor on every sighting; print changes only.
        if peer.startswith("off1") and (t == "neighbor_discovered") != (peer in neighbors):
            (neighbors.add if t == "neighbor_discovered" else neighbors.discard)(peer)
            print(f"{now}  {t.replace('_', ' ')}: {short(peer)}", flush=True)


async def main() -> None:
    config = ProtocolConfig(
        app_id="carerounds",  # the phones' app id: the mesh only joins its own
        profile="mac-relay",
        ble_enabled=True,
        wifi_direct_enabled=False,
        internet_enabled=False,
        reticulum_enabled=False,
        nostr_enabled=False,
        prefer_online=False,
        initial_ttl=8,
        encryption_enabled=True,
        auto_key_exchange=True,
        store_pending=True,
        max_pending_per_peer=100,
        max_pending_global=1000,
        pending_ttl_ms=180_000,
        overflow_policy=OverflowPolicy.DROP_OLDEST,
    )
    state = Path(tempfile.gettempdir()) / "carerounds-mac-relay"
    async with ProtocolManager(config, event_handler=on_event, state_root=state) as pm:
        pm.protocol.update_relay_config(
            RelayConfig(min_battery_for_relay=0, allow_relay=True, relay_priority=RelayPriority.ALWAYS)
        )
        pm.protocol.set_battery_state(100, True)  # a plugged-in Mac never saves battery
        for transport in (pm.ble, pm.ble_peripheral):
            if transport is not None and transport.is_available():
                await transport.start()
        print(f"Relay up as {short(pm.local_address or '')}. Ctrl+C to stop.", flush=True)
        stop = asyncio.Event()
        asyncio.get_running_loop().add_signal_handler(signal.SIGINT, stop.set)
        await stop.wait()


if __name__ == "__main__":
    asyncio.run(main())
