"""Verify Husnain sees a private channel immediately after being added."""

from __future__ import annotations

import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = "http://127.0.0.1:4000"
OWNER_EMAIL = "owner@demo.com"
HUSNAIN_EMAIL = "htrajpoot3998@gmail.com"
PASSWORD = "password123"


def login(client: httpx.Client, email: str) -> tuple[str, str]:
    res = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    res.raise_for_status()
    body = res.json()
    token = body["accessToken"]
    ws = body.get("user", {}).get("workspaces")
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    me.raise_for_status()
    workspace_id = me.json()["workspaces"][0]["id"]
    user_id = me.json()["id"]
    return token, workspace_id, user_id


def channel_names(client: httpx.Client, token: str, ws: str) -> list[str]:
    res = client.get(
        f"/api/v1/workspaces/{ws}/chat/channels",
        headers={"Authorization": f"Bearer {token}"},
    )
    res.raise_for_status()
    return [c["name"] for c in res.json()["data"]]


def main() -> int:
    with httpx.Client(base_url=BASE, timeout=120.0) as client:
        owner_token, ws, _ = login(client, OWNER_EMAIL)
        husnain_token, _, husnain_id = login(client, HUSNAIN_EMAIL)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        husnain_headers = {"Authorization": f"Bearer {husnain_token}"}

        channel_name = "test private join api"
        create = client.post(
            f"/api/v1/workspaces/{ws}/chat/channels",
            headers=owner_headers,
            json={
                "name": channel_name,
                "isPrivate": True,
                "memberIds": [husnain_id],
            },
        )
        if create.status_code == 409:
            channels = client.get(
                f"/api/v1/workspaces/{ws}/chat/channels",
                headers=owner_headers,
            ).json()["data"]
            channel = next(
                (c for c in channels if c["name"].lower() == channel_name.lower()),
                None,
            )
            if not channel:
                print("Could not find or create channel")
                return 1
            channel_id = channel["id"]
            add = client.post(
                f"/api/v1/workspaces/{ws}/chat/channels/{channel_id}/members",
                headers=owner_headers,
                json={"userIds": [husnain_id]},
            )
            print("re-add member", add.status_code, add.text[:200])
        else:
            create.raise_for_status()
            channel_id = create.json()["id"]
            print("created channel", channel_id)

        husnain_channels = channel_names(client, husnain_token, ws)
        print("Husnain channels:", husnain_channels)
        if channel_name.lower() in [n.lower() for n in husnain_channels]:
            print("SUCCESS: channel visible in Husnain channel list API")
            return 0
        print("FAIL: channel missing from Husnain list (membership not created?)")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
