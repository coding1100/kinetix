"""End-to-end workspace API tests (live server on port 4000)."""

from __future__ import annotations

import os
import sys
import time

import httpx

BASE = os.environ.get("API_BASE", "http://127.0.0.1:4000").rstrip("/")
OWNER = ("owner@demo.com", "password123")
MEMBER = ("alex@demo.com", "password123")
TIMEOUT = 120.0

passed: list[str] = []
failures: list[str] = []


def ok(name: str) -> None:
    passed.append(name)
    print(f"  PASS  {name}")


def fail(name: str, detail: str) -> None:
    failures.append(f"{name}: {detail}")
    print(f"  FAIL  {name}: {detail}")


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login(client: httpx.Client, email: str, password: str) -> str:
    res = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    if res.status_code != 200:
        raise RuntimeError(f"login {email} -> {res.status_code} {res.text[:200]}")
    return res.json()["accessToken"]


def main() -> int:
    print("=== Workspace API test suite ===\n")
    with httpx.Client(base_url=BASE, timeout=TIMEOUT) as client:
        health = client.get("/health")
        if health.status_code != 200:
            print(f"API unhealthy at {BASE}: {health.status_code}")
            return 1
        ok("health")

        try:
            owner_token = login(client, *OWNER)
            member_token = login(client, *MEMBER)
        except RuntimeError as exc:
            print(f"Setup failed: {exc}")
            return 1
        oh = auth(owner_token)
        mh = auth(member_token)

        listed = client.get("/api/v1/workspaces", headers=oh)
        if listed.status_code != 200:
            fail("list workspaces", listed.text[:200])
        else:
            ok("list workspaces")
            count_before = len(listed.json().get("data") or [])

        name = f"E2E WS {int(time.time())}"
        created = client.post(
            "/api/v1/workspaces", headers=oh, json={"name": name}
        )
        if created.status_code != 201:
            fail("create workspace", created.text[:300])
            return 1
        workspace_id = created.json()["id"]
        ok("create workspace")

        listed_after = client.get("/api/v1/workspaces", headers=oh)
        if listed_after.status_code == 200:
            rows = listed_after.json().get("data") or []
            if len(rows) != count_before + 1:
                fail("list after create", f"expected {count_before + 1}, got {len(rows)}")
            elif not any(w["id"] == workspace_id and w["role"] == "OWNER" for w in rows):
                fail("list after create", "new workspace missing or wrong role")
            else:
                ok("list includes new workspace as OWNER")

        me = client.get("/api/v1/auth/me", headers=oh)
        if me.status_code == 200:
            ids = {w["id"] for w in me.json().get("workspaces") or []}
            if workspace_id in ids:
                ok("auth/me includes new workspace")
            else:
                fail("auth/me", "new workspace not in me.workspaces")

        detail = client.get(f"/api/v1/workspaces/{workspace_id}", headers=oh)
        if detail.status_code == 200 and detail.json().get("role") == "OWNER":
            ok("get workspace detail")
        else:
            fail("get workspace", detail.text[:200])

        denied = client.get(f"/api/v1/workspaces/{workspace_id}", headers=mh)
        if denied.status_code == 403:
            ok("non-member forbidden")
        else:
            fail("non-member access", f"expected 403, got {denied.status_code}")

        renamed = f"{name} Updated"
        patched = client.patch(
            f"/api/v1/workspaces/{workspace_id}",
            headers=oh,
            json={"name": renamed},
        )
        if patched.status_code == 200 and patched.json().get("name") == renamed:
            ok("update workspace name")
        else:
            fail("update workspace", patched.text[:200])

        test_email = f"e2e-ws-{int(time.time())}@example.com"
        invite = client.post(
            f"/api/v1/workspaces/{workspace_id}/invites",
            headers=oh,
            json={"email": test_email, "role": "MEMBER"},
        )
        if invite.status_code != 201:
            fail("create invite", invite.text[:200])
        else:
            ok("create invite")
            invite_id = invite.json()["id"]
            invite_token = invite.json()["token"]

        invites = client.get(
            f"/api/v1/workspaces/{workspace_id}/invites", headers=oh
        )
        if invites.status_code == 200:
            ok("list invites")
        else:
            fail("list invites", invites.text[:200])

        accept = client.post(
            f"/api/v1/invites/{invite_token}/accept-signup",
            json={"fullName": "E2E Member", "password": "password123"},
        )
        if accept.status_code in (200, 201):
            ok("accept invite signup")
            member_user_id = accept.json()["user"]["id"]
        else:
            fail("accept invite", accept.text[:200])
            member_user_id = None

        members = client.get(
            f"/api/v1/workspaces/{workspace_id}/members", headers=oh
        )
        if members.status_code == 200:
            emails = [m["email"].lower() for m in members.json().get("data") or []]
            if test_email.lower() in emails:
                ok("member appears after accept")
            else:
                fail("members after accept", "invitee not listed")
        else:
            fail("list members", members.text[:200])

        if member_user_id:
            role = client.patch(
                f"/api/v1/workspaces/{workspace_id}/members/{member_user_id}",
                headers=oh,
                json={"role": "GUEST"},
            )
            if role.status_code == 200:
                ok("patch member role")
            else:
                fail("patch member role", role.text[:200])

            removed = client.delete(
                f"/api/v1/workspaces/{workspace_id}/members/{member_user_id}",
                headers=oh,
            )
            if removed.status_code == 200:
                ok("remove member")
            else:
                fail("remove member", removed.text[:200])

        transfer_email = f"transfer-{int(time.time())}@example.com"
        t_invite = client.post(
            f"/api/v1/workspaces/{workspace_id}/invites",
            headers=oh,
            json={"email": transfer_email, "role": "MEMBER"},
        )
        if t_invite.status_code == 201:
            t_accept = client.post(
                f"/api/v1/invites/{t_invite.json()['token']}/accept-signup",
                json={"fullName": "Transfer User", "password": "password123"},
            )
            if t_accept.status_code in (200, 201):
                new_owner_id = t_accept.json()["user"]["id"]
                transfer = client.post(
                    f"/api/v1/workspaces/{workspace_id}/transfer-ownership",
                    headers=oh,
                    json={"newOwnerUserId": new_owner_id},
                )
                if transfer.status_code == 200:
                    ok("transfer ownership")
                else:
                    fail("transfer ownership", transfer.text[:200])

        delete_name = f"Delete Me {int(time.time())}"
        del_ws = client.post(
            "/api/v1/workspaces", headers=oh, json={"name": delete_name}
        )
        if del_ws.status_code == 201:
            del_id = del_ws.json()["id"]
            bad = client.request(
                "DELETE",
                f"/api/v1/workspaces/{del_id}",
                headers=oh,
                json={"confirmName": "wrong"},
            )
            if bad.status_code == 400:
                ok("delete workspace name validation")
            else:
                fail("delete validation", f"expected 400, got {bad.status_code}")

            removed = client.request(
                "DELETE",
                f"/api/v1/workspaces/{del_id}",
                headers=oh,
                json={"confirmName": delete_name},
            )
            if removed.status_code == 200:
                ok("delete workspace")
            else:
                fail("delete workspace", removed.text[:200])

        cancel_email = f"cancel-{int(time.time())}@example.com"
        pending = client.post(
            f"/api/v1/workspaces/{workspace_id}/invites",
            headers=oh,
            json={"email": cancel_email, "role": "MEMBER"},
        )
        if pending.status_code == 201:
            pending_id = pending.json()["id"]
            deleted = client.delete(
                f"/api/v1/workspaces/{workspace_id}/invites/{pending_id}",
                headers=oh,
            )
            if deleted.status_code == 200:
                ok("cancel invite")
            else:
                fail("cancel invite", deleted.text[:200])

    print(f"\n{len(passed)} passed, {len(failures)} failed")
    for f in failures:
        print(f"  - {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
