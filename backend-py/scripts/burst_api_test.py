"""Simulate chat page parallel API burst."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = "http://127.0.0.1:4000"
WS = "96a5898f-5ebf-4c12-933f-6b33884ca7c9"
CHANNEL = "17960389-9375-4b4a-b44a-326a0fd8e88c"


async def main() -> int:
    async with httpx.AsyncClient(base_url=BASE, timeout=120.0) as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "owner@demo.com", "password": "password123"},
        )
        if login.status_code != 200:
            print("login failed", login.status_code, login.text[:200])
            return 1
        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        paths = [
            f"/api/v1/workspaces/{WS}/home/unread-summary",
            f"/api/v1/workspaces/{WS}/chat/dms",
            f"/api/v1/workspaces/{WS}/chat/channels",
            f"/api/v1/workspaces/{WS}/members",
            f"/api/v1/workspaces/{WS}/chat/channels/{CHANNEL}",
            f"/api/v1/workspaces/{WS}/chat/channels/{CHANNEL}/messages",
            f"/api/v1/workspaces/{WS}/chat/channels/{CHANNEL}/members",
            f"/api/v1/auth/me",
            f"/api/v1/workspaces/{WS}/home/notifications",
        ]

        async def hit(path: str) -> tuple[str, int, str]:
            try:
                res = await client.get(path, headers=headers)
                return path, res.status_code, "ok" if res.status_code < 400 else res.text[:80]
            except Exception as exc:
                return path, 0, type(exc).__name__

        print("burst 1...")
        results = await asyncio.gather(*(hit(p) for p in paths))
        for path, status, note in results:
            print(f"  {status} {path.split('/')[-1] or path} {note}")

        failed = [r for r in results if r[1] != 200]
        if failed:
            print("FAILED", len(failed))
            return 1

        print("burst 2 (repeat)...")
        results2 = await asyncio.gather(*(hit(p) for p in paths))
        failed2 = [r for r in results2 if r[1] != 200]
        for path, status, note in results2:
            print(f"  {status} {path.split('/')[-1] or path} {note}")

        if failed2:
            print("FAILED repeat", len(failed2))
            return 1

        print("ALL OK")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
