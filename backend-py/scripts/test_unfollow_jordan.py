"""Test: alex@demo.com unfollows Jordan Lee from #general."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = os.environ.get("API_TEST_BASE", "http://127.0.0.1:4000").rstrip("/")
IN_PROCESS = os.environ.get("API_TEST_IN_PROCESS", "").lower() in ("1", "true", "yes")
EMAILS = ["alex@demo.com", "alex@dem.com"]
PASSWORD = "password123"


def _make_client():
    if IN_PROCESS:
        from starlette.testclient import TestClient

        from app.main import app

        return TestClient(app)
    return httpx.Client(base_url=BASE, timeout=120.0)


def _request(client, method: str, url: str, **kwargs):
    if hasattr(client, "request"):
        return client.request(method, url, **kwargs)
    fn = getattr(client, method.lower())
    return fn(url, **kwargs)


def main() -> int:
    with _make_client() as client:
        health = _request(client, "GET", "/health")
        print("=== Health ===")
        print(health.status_code, health.text[:300])
        if health.status_code != 200:
            print("  /health unavailable — continuing (proxied deployment)")

        token = None
        email_used = None
        print("\n=== Login ===")
        for email in EMAILS:
            login = _request(
                client,
                "POST",
                "/api/v1/auth/login",
                json={"email": email, "password": PASSWORD},
            )
            print(f"  {email}: {login.status_code}")
            if login.status_code == 200:
                token = login.json().get("accessToken")
                email_used = email
                break
            print(f"  {login.text[:200]}")

        if not token:
            print("Login failed for all emails")
            return 2

        headers = {"Authorization": f"Bearer {token}"}
        me = _request(client, "GET", "/api/v1/auth/me", headers=headers)
        me_body = me.json()
        workspace_id = me_body["workspaces"][0]["id"]
        actor = me_body.get("fullName", email_used)
        print(f"  actor={actor} workspace={workspace_id}")

        channels = None
        for attempt in range(1, 6):
            channels = _request(
                client,
                "GET",
                f"/api/v1/workspaces/{workspace_id}/chat/channels",
                headers=headers,
            )
            print(f"  channels attempt {attempt}: {channels.status_code}")
            if channels.status_code == 200:
                break
            if channels.status_code == 503:
                time.sleep(2)
                continue
            print(channels.text[:500])
            return 3
        if channels is None or channels.status_code != 200:
            print(channels.text[:500] if channels else "no response")
            return 3

        channel_body = channels.json()
        channel_list = channel_body.get("data")
        if channel_list is None:
            print("Unexpected channels response:", channel_body)
            return 3

        general = next(
            (c for c in channel_list if c.get("name", "").lower() == "general"),
            channel_list[0] if channel_list else None,
        )
        if not general:
            print("No channels found")
            return 3
        channel_id = general["id"]
        print(f"\n=== Channel: {general.get('name')} ({channel_id}) ===")

        members_res = None
        for attempt in range(1, 6):
            members_res = _request(
                client,
                "GET",
                f"/api/v1/workspaces/{workspace_id}/chat/channels/{channel_id}/members",
                headers=headers,
            )
            print(f"  members attempt {attempt}: {members_res.status_code}")
            if members_res.status_code == 200:
                break
            if members_res.status_code == 503:
                time.sleep(2)
                continue
            print(members_res.text[:500])
            return 4

        members_body = members_res.json() if members_res else {}
        members = members_body.get("data")
        if members is None:
            print("Unexpected members response:", members_body)
            return 4

        jordan = next(
            (m for m in members if "jordan" in m.get("fullName", "").lower()),
            None,
        )
        if not jordan:
            print("Jordan Lee not found. Members:")
            for m in members:
                print(f"  - {m.get('fullName')} following={m.get('isFollowing')}")
            return 4

        print(
            "Jordan before:",
            json.dumps(
                {
                    "id": jordan["id"],
                    "fullName": jordan["fullName"],
                    "isFollowing": jordan["isFollowing"],
                }
            ),
        )

        patch = None
        for attempt in range(1, 8):
            patch = _request(
                client,
                "PATCH",
                f"/api/v1/workspaces/{workspace_id}/chat/channels/{channel_id}/members/{jordan['id']}",
                headers=headers,
                json={"isFollowing": False},
            )
            print(f"\n=== PATCH unfollow attempt {attempt}: {patch.status_code} ===")
            print(patch.text[:500])
            if patch.status_code == 200:
                break
            if patch.status_code == 503:
                time.sleep(3)
                continue
            return 5
        if patch is None or patch.status_code != 200:
            return 5

        members_after = _request(
            client,
            "GET",
            f"/api/v1/workspaces/{workspace_id}/chat/channels/{channel_id}/members",
            headers=headers,
        ).json()["data"]
        jordan_after = next(
            (m for m in members_after if m["id"] == jordan["id"]),
            None,
        )
        print(
            "Jordan after:",
            json.dumps(
                {
                    "id": jordan_after["id"] if jordan_after else None,
                    "fullName": jordan_after["fullName"] if jordan_after else None,
                    "isFollowing": jordan_after["isFollowing"] if jordan_after else None,
                }
            ),
        )

        if jordan_after and jordan_after["isFollowing"] is False:
            print("\nSUCCESS: Jordan Lee unfollowed from general")
            return 0
        print("\nFAILED: isFollowing still true")
        return 6


if __name__ == "__main__":
    raise SystemExit(main())
