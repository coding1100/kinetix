"""
Add a test workspace member via invite + accept-signup, then verify People APIs.

Usage (API on port 4000):
  cd backend-py
  python scripts/verify_workspace_people.py

Optional:
  API_BASE=http://127.0.0.1:4000 python scripts/verify_workspace_people.py
"""

from __future__ import annotations

import os
import sys

import httpx

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:4000").rstrip("/")
OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "owner@demo.com")
OWNER_PASSWORD = os.environ.get("TEST_OWNER_PASSWORD", "password123")
TEST_EMAIL = os.environ.get("TEST_MEMBER_EMAIL", "teammate@example.com")
TEST_NAME = "Test Teammate"
TEST_PASSWORD = "password123"


def fail(msg: str, res: httpx.Response | None = None) -> None:
    detail = f" — {res.text}" if res is not None else ""
    print(f"FAIL: {msg}{detail}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"OK: {msg}")


def main() -> None:
    timeout = httpx.Timeout(15.0)
    try:
        health = httpx.get(f"{API_BASE}/health", timeout=timeout)
    except Exception as exc:
        fail(f"API not reachable at {API_BASE} ({exc})")

    if health.status_code != 200:
        fail("Health check failed", health)

    ok(f"API healthy at {API_BASE}")

    login = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=timeout,
    )
    if login.status_code != 200:
        fail("Owner login failed", login)

    token = login.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    me = httpx.get(f"{API_BASE}/api/v1/auth/me", headers=headers, timeout=timeout)
    if me.status_code != 200:
        fail("GET /auth/me failed", me)

    workspace_id = me.json()["workspaces"][0]["id"]
    ws_name = me.json()["workspaces"][0]["name"]
    ok(f"Workspace: {ws_name} ({workspace_id})")

    members_before = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{workspace_id}/members",
        headers=headers,
        timeout=timeout,
    )
    if members_before.status_code != 200:
        fail("List members failed", members_before)

    before = members_before.json()["data"]
    print(f"  Members before: {len(before)}")
    for m in before:
        print(f"    - {m['fullName']} <{m['email']}> ({m['role']})")

    already = next(
        (m for m in before if m["email"].lower() == TEST_EMAIL.lower()),
        None,
    )
    if already:
        ok(f"{TEST_EMAIL} already in workspace — skipping invite")
        test_user_id = already["id"]
    else:
        invite = httpx.post(
            f"{API_BASE}/api/v1/workspaces/{workspace_id}/invites",
            headers=headers,
            json={"email": TEST_EMAIL, "role": "MEMBER"},
            timeout=timeout,
        )
        if invite.status_code not in (200, 201):
            fail("Create invite failed", invite)

        invite_body = invite.json()
        invite_url = invite_body.get("inviteUrl", "")
        invite_token = invite_body.get("token")
        if not invite_token and "token=" in invite_url:
            invite_token = invite_url.split("token=")[-1].split("&")[0]
        if not invite_token:
            fail("No invite token in response")

        ok(f"Invite created for {TEST_EMAIL}")

        accept = httpx.post(
            f"{API_BASE}/api/v1/invites/{invite_token}/accept-signup",
            json={"fullName": TEST_NAME, "password": TEST_PASSWORD},
            timeout=timeout,
        )
        if accept.status_code not in (200, 201):
            fail("Accept invite signup failed", accept)

        test_user_id = accept.json()["user"]["id"]
        ok(f"Accepted invite — user id {test_user_id}")

    members_after = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{workspace_id}/members",
        headers=headers,
        timeout=timeout,
    )
    if members_after.status_code != 200:
        fail("List members after failed", members_after)

    after = members_after.json()["data"]
    added = next(
        (m for m in after if m["email"].lower() == TEST_EMAIL.lower()),
        None,
    )
    if not added:
        fail(f"{TEST_EMAIL} not found in member list after invite")

    ok(f"Member visible in workspace ({len(after)} total)")

    invites = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{workspace_id}/invites",
        headers=headers,
        timeout=timeout,
    )
    if invites.status_code != 200:
        fail("List invites failed", invites)

    pending_for_test = [
        i
        for i in invites.json()["data"]
        if i["email"].lower() == TEST_EMAIL.lower()
    ]
    if pending_for_test:
        fail(f"Invite still pending for {TEST_EMAIL}")

    ok("No pending invite left for test user")

    member_login = httpx.post(
        f"{API_BASE}/api/v1/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=timeout,
    )
    if member_login.status_code != 200:
        fail("Test member login failed", member_login)

    member_token = member_login.json()["accessToken"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    channels = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{workspace_id}/chat/channels",
        headers=member_headers,
        timeout=timeout,
    )
    if channels.status_code != 200:
        fail("Test member cannot list channels", channels)

    ok(f"Test member can access chat ({len(channels.json()['data'])} channels)")

    dms = httpx.get(
        f"{API_BASE}/api/v1/workspaces/{workspace_id}/chat/dms",
        headers=member_headers,
        timeout=timeout,
    )
    if dms.status_code != 200:
        fail("Test member cannot list DMs", dms)

    ok("Test member can access DMs")

    print("\nAll workspace people checks passed.")
    print(f"  Login as: {TEST_EMAIL} / {TEST_PASSWORD}")
    print("  Open People in the app to see them in the table.")


if __name__ == "__main__":
    main()
