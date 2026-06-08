"""Measure chat load API timing and request success."""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = "http://127.0.0.1:4000"
WS = "96a5898f-5ebf-4c12-933f-6b33884ca7c9"
CHANNEL = "17960389-9375-4b4a-b44a-326a0fd8e88c"


async def timed_get(client: httpx.AsyncClient, path: str, headers: dict) -> tuple[str, int, float]:
    start = time.perf_counter()
    try:
        res = await client.get(path, headers=headers)
        return path.split("/")[-1] or path, res.status_code, time.perf_counter() - start
    except Exception as exc:
        return path.split("/")[-1] or path, 0, time.perf_counter() - start


async def main() -> int:
    async with httpx.AsyncClient(base_url=BASE, timeout=120.0) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "owner@demo.com", "password": "password123"},
        )
        if login.status_code != 200:
            print("login failed", login.status_code)
            return 1
        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        print("=== Sidebar load (sequential, deduped pattern) ===")
        t0 = time.perf_counter()
        _, status_ch, dt_ch = await timed_get(
            client, f"/api/v1/workspaces/{WS}/chat/channels", headers
        )
        _, status_dm, dt_dm = await timed_get(
            client, f"/api/v1/workspaces/{WS}/chat/dms", headers
        )
        print(f"  channels {status_ch} {dt_ch:.2f}s")
        print(f"  dms      {status_dm} {dt_dm:.2f}s")
        print(f"  total    {time.perf_counter() - t0:.2f}s")

        print("=== Open channel (messages only path) ===")
        t1 = time.perf_counter()
        _, status_msg, dt_msg = await timed_get(
            client,
            f"/api/v1/workspaces/{WS}/chat/channels/{CHANNEL}/messages",
            headers,
        )
        print(f"  messages {status_msg} {dt_msg:.2f}s")
        print(f"  total    {time.perf_counter() - t1:.2f}s")

        dms = (await client.get(f"/api/v1/workspaces/{WS}/chat/dms", headers=headers)).json()
        dm_id = dms["data"][0]["id"] if dms.get("data") else None
        if dm_id:
            print("=== Open DM (messages only path) ===")
            t2 = time.perf_counter()
            _, status_dm_msg, dt_dm_msg = await timed_get(
                client,
                f"/api/v1/workspaces/{WS}/chat/dms/{dm_id}/messages",
                headers,
            )
            print(f"  messages {status_dm_msg} {dt_dm_msg:.2f}s")
            print(f"  total    {time.perf_counter() - t2:.2f}s")

        failed = [s for s in (status_ch, status_dm, status_msg) if s != 200]
        if dm_id and status_dm_msg != 200:
            failed.append(status_dm_msg)
        if failed:
            print("FAILED", failed)
            return 1

        print("ALL OK")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
