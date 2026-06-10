"""Verify inbox notification when user is added to private channel access."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os

BASE = os.environ.get("API_TEST_BASE", "http://127.0.0.1:4000").rstrip("/")
IN_PROCESS = os.environ.get("API_TEST_IN_PROCESS", "").lower() in ("1", "true", "yes")
OWNER = "owner@demo.com"
HUSNAIN = "htrajpoot3998@gmail.com"
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


def login(client, email: str) -> tuple[str, str, str]:
    token = _request(
        client, "POST", "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    ).json()["accessToken"]
    me = _request(
        client, "GET", "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    ).json()
    return token, me["workspaces"][0]["id"], me["id"]


def main() -> int:
    with _make_client() as client:
        owner_token, ws, owner_id = login(client, OWNER)
        husnain_token, _, husnain_id = login(client, HUSNAIN)
        owner_h = {"Authorization": f"Bearer {owner_token}"}
        husnain_h = {"Authorization": f"Bearer {husnain_token}"}

        name = f"notify access {int(time.time())}"
        create = _request(
            client,
            "POST",
            f"/api/v1/workspaces/{ws}/chat/channels",
            headers=owner_h,
            json={"name": name, "isPrivate": True, "memberIds": [husnain_id]},
        )
        create.raise_for_status()
        channel_id = create.json()["id"]
        print("created", name)

        notifs = _request(
            client,
            "GET",
            f"/api/v1/workspaces/{ws}/home/notifications",
            headers=husnain_h,
        )
        notifs.raise_for_status()
        body = notifs.json()
        match = [
            n
            for n in body["data"]
            if name.lower() in n.get("title", "").lower()
            or name.lower() in n.get("preview", "").lower()
        ]
        print("Husnain notifications:", len(body["data"]), "unread", body["unreadCount"])
        if not match:
            print("FAIL: no channel access notification for Husnain after add")
            for n in body["data"][:5]:
                print(" -", n.get("title"), n.get("preview"))
            return 1

        print("ADD OK:", match[0]["title"])

        rm = _request(
            client,
            "DELETE",
            f"/api/v1/workspaces/{ws}/chat/channels/{channel_id}/members/{husnain_id}",
            headers=owner_h,
        )
        rm.raise_for_status()
        notifs2 = _request(
            client,
            "GET",
            f"/api/v1/workspaces/{ws}/home/notifications",
            headers=husnain_h,
        ).json()
        removed = [
            n
            for n in notifs2["data"]
            if "removed from" in n.get("title", "").lower()
        ]
        if removed:
            print("REMOVE OK:", removed[0]["title"])
            return 0
        print("FAIL: no removal notification for Husnain")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
