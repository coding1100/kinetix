"""Test login + send channel message on the running API."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = "http://127.0.0.1:4000"
EMAIL = "owner@demo.com"
PASSWORD = "password123"
CHANNEL_ID = "dc943c9d-c1a2-474d-8d23-277f4b68c407"


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=120.0) as client:
        print("=== Health ===")
        try:
            t0 = time.perf_counter()
            health = client.get("/health")
            print(f"  {health.status_code} in {time.perf_counter() - t0:.1f}s")
            print(f"  {health.text[:300]}")
        except Exception as exc:
            print(f"  FAILED: {exc}")
            return 1

        print("\n=== Login ===")
        login = client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        print(f"  {login.status_code}")
        if login.status_code != 200:
            print(login.text[:400])
            return 1
        token = login.json().get("accessToken")
        if not token:
            print("  Missing accessToken in login response")
            print(login.text[:400])
            return 1

        workspaces = client.get(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token}"},
        )
        print(f"  workspaces {workspaces.status_code}")
        if workspaces.status_code != 200:
            print(workspaces.text[:400])
            return 1
        workspace_id = workspaces.json().get("data", [{}])[0].get("id")
        if not workspace_id:
            print("  No workspace found for user")
            return 1
        print(f"  workspace_id={workspace_id}")

        print("\n=== POST message (direct backend) ===")
        t1 = time.perf_counter()
        msg = client.post(
            f"/api/v1/workspaces/{workspace_id}/chat/channels/{CHANNEL_ID}/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={"body": f"diagnostic ping {int(time.time())}"},
        )
        dt = time.perf_counter() - t1
        print(f"  {msg.status_code} in {dt:.1f}s")
        print(f"  {msg.text[:400]}")
        if msg.status_code not in (200, 201):
            return 1

        print("\n=== POST message (via nginx :80) ===")
        try:
            with httpx.Client(base_url="http://127.0.0.1", timeout=120.0) as nginx:
                t2 = time.perf_counter()
                proxied = nginx.post(
                    f"/api/v1/workspaces/{workspace_id}/chat/channels/{CHANNEL_ID}/messages",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"body": f"nginx ping {int(time.time())}"},
                )
                dt2 = time.perf_counter() - t2
                print(f"  {proxied.status_code} in {dt2:.1f}s")
                print(f"  {proxied.text[:400]}")
                if proxied.status_code not in (200, 201):
                    return 1
        except Exception as exc:
            print(f"  nginx test skipped/failed: {exc}")

        print("\nALL OK")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
