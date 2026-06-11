"""Diagnose delete permission for a channel by name."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = os.environ.get("API_TEST_BASE", "http://127.0.0.1:4000").rstrip("/")
EMAIL = os.environ.get("TEST_EMAIL", "alex@demo.com")
PASSWORD = "password123"
CHANNEL_NEEDLE = os.environ.get("CHANNEL_NAME", "members channel").lower()


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        print("login", login.status_code, login.text[:200])
        if login.status_code != 200:
            return 1
        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}
        me = client.get("/api/v1/auth/me", headers=headers)
        user_id = me.json()["id"]
        ws = me.json()["workspaces"][0]["id"]
        print("user", EMAIL, user_id, "workspace", ws)

        channels = client.get(
            f"/api/v1/workspaces/{ws}/chat/channels", headers=headers
        )
        print("channels", channels.status_code)
        data = channels.json().get("data", [])
        match = next(
            (c for c in data if CHANNEL_NEEDLE in c.get("name", "").lower()),
            None,
        )
        if not match:
            print("No channel matching", CHANNEL_NEEDLE)
            for c in data:
                print(" -", c.get("name"), c.get("id"))
            return 1

        cid = match["id"]
        print("\nchannel list entry:")
        print(json.dumps(match, indent=2))

        detail = client.get(
            f"/api/v1/workspaces/{ws}/chat/channels/{cid}", headers=headers
        )
        print("\nchannel detail:")
        print(json.dumps(detail.json(), indent=2))

        delete = client.delete(
            f"/api/v1/workspaces/{ws}/chat/channels/{cid}", headers=headers
        )
        print("\ndelete attempt:", delete.status_code, delete.text)
        return 0 if delete.status_code == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
