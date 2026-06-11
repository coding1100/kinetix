"""End-to-end API tests for chat enhancement features."""

from __future__ import annotations

import json
import sys
import time
from typing import Any

import httpx
import socketio
from pydantic_settings import BaseSettings, SettingsConfigDict


class _Env(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    frontend_url: str = "http://localhost:3001"


BASE = "http://127.0.0.1:4000"
SOCKET_BASE = BASE
SOCKET_ORIGIN = _Env().frontend_url
OWNER = ("owner@demo.com", "password123")
MEMBER = ("alex@demo.com", "password123")
TIMEOUT = 120.0

failures: list[str] = []
passed: list[str] = []


def ok(name: str) -> None:
    passed.append(name)
    print(f"  PASS  {name}")


def fail(name: str, detail: str) -> None:
    failures.append(f"{name}: {detail}")
    print(f"  FAIL  {name}: {detail}")


def login(client: httpx.Client, email: str, password: str) -> tuple[str, str]:
    res = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    if res.status_code != 200:
        raise RuntimeError(f"login {email} -> {res.status_code} {res.text[:200]}")
    body = res.json()
    token = body.get("accessToken")
    if not token:
        raise RuntimeError(f"login {email} missing accessToken")
    ws = client.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {token}"})
    if ws.status_code != 200 or not ws.json().get("data"):
        raise RuntimeError(f"workspaces for {email} -> {ws.status_code}")
    workspace_id = ws.json()["data"][0]["id"]
    return token, workspace_id


def ws_path(workspace_id: str, path: str) -> str:
    return f"/api/v1/workspaces/{workspace_id}{path}"


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    print("=== Chat enhancements API test suite ===\n")
    with httpx.Client(base_url=BASE, timeout=TIMEOUT) as client:
        health = client.get("/health")
        if health.status_code != 200:
            print(f"API unhealthy: {health.status_code}")
            return 1

        try:
            owner_token, ws = login(client, *OWNER)
            member_token, ws2 = login(client, *MEMBER)
        except RuntimeError as exc:
            print(f"Setup failed: {exc}")
            return 1
        if ws != ws2:
            fail("workspace", "owner and member in different workspaces")
            return 1

        h = auth(owner_token)
        mh = auth(member_token)

        # Pick or create channel
        channels = client.get(ws_path(ws, "/chat/channels"), headers=h)
        if channels.status_code != 200:
            fail("list channels", channels.text[:200])
            return 1
        channel_list = channels.json().get("data") or []
        channel_id = channel_list[0]["id"] if channel_list else None
        if not channel_id:
            created = client.post(
                ws_path(ws, "/chat/channels"),
                headers=h,
                json={"name": f"enhance-test-{int(time.time())}"},
            )
            if created.status_code not in (200, 201):
                fail("create channel", created.text[:200])
                return 1
            channel_id = created.json()["id"]

        # 1. Pin channel
        pin_ch = client.patch(
            ws_path(ws, f"/chat/channels/{channel_id}/pin"),
            headers=h,
            json={"pinned": True},
        )
        if pin_ch.status_code == 200 and pin_ch.json().get("pinned") is True:
            ok("pin channel")
        else:
            fail("pin channel", f"{pin_ch.status_code} {pin_ch.text[:200]}")

        ch_list = client.get(ws_path(ws, "/chat/channels"), headers=h)
        pinned_found = any(
            c.get("id") == channel_id and c.get("pinnedAt") for c in ch_list.json().get("data", [])
        )
        if pinned_found:
            ok("channel list includes pinnedAt")
        else:
            fail("channel list pinnedAt", ch_list.text[:300])

        # 2. Notification settings
        notif = client.patch(
            ws_path(ws, f"/chat/channels/{channel_id}/member"),
            headers=h,
            json={"notificationLevel": "NONE"},
        )
        if notif.status_code == 200:
            ok("notification level NONE")
        else:
            fail("notification level", f"{notif.status_code} {notif.text[:200]}")

        ch_detail = client.get(ws_path(ws, f"/chat/channels/{channel_id}"), headers=h)
        if ch_detail.json().get("notificationLevel") == "NONE":
            ok("notification level persisted on channel")
        else:
            fail(
                "notification persisted",
                json.dumps(ch_detail.json())[:300],
            )

        client.patch(
            ws_path(ws, f"/chat/channels/{channel_id}/member"),
            headers=h,
            json={"notificationLevel": "MENTIONS"},
        )

        # 3. Send message + pin message + pagination
        client.patch(
            ws_path(ws, f"/chat/channels/{channel_id}/member"),
            headers=mh,
            json={"notificationLevel": "ALL"},
        )
        channel_msg_body = f"enhance-test @channel {int(time.time())}"
        msg = client.post(
            ws_path(ws, f"/chat/channels/{channel_id}/messages"),
            headers=h,
            json={"body": channel_msg_body},
        )
        if msg.status_code not in (200, 201):
            fail("send channel message", f"{msg.status_code} {msg.text[:200]}")
            return 1
        message_id = msg.json()["id"]
        ok("send channel message with @channel")
        time.sleep(0.5)
        inbox = client.get(ws_path(ws, "/home/inbox"), headers=mh)
        if inbox.status_code == 200:
            items = inbox.json().get("data") or []
            if any(
                channel_msg_body.split("@channel")[0].strip() in (i.get("preview") or "")
                or "@channel" in (i.get("preview") or "").lower()
                for i in items
            ):
                ok("@channel notification inbox (ALL level)")
            else:
                fail("@channel inbox", "member did not receive channel notification")
        else:
            fail("@channel inbox fetch", inbox.text[:200])

        pin_msg = client.patch(
            ws_path(ws, f"/chat/messages/{message_id}/pin"),
            headers=h,
            json={"pinned": True},
        )
        if pin_msg.status_code == 200 and pin_msg.json().get("pinnedAt"):
            ok("pin message")
        else:
            fail("pin message", f"{pin_msg.status_code} {pin_msg.text[:200]}")

        page = client.get(
            ws_path(ws, f"/chat/channels/{channel_id}/messages?limit=5"),
            headers=h,
        )
        if page.status_code == 200 and "data" in page.json():
            body = page.json()
            if "hasMore" in body or len(body["data"]) <= 5:
                ok("message pagination")
            else:
                fail("pagination shape", json.dumps(body)[:200])
        else:
            fail("pagination", f"{page.status_code} {page.text[:200]}")

        # 4. Global search
        search = client.get(
            ws_path(ws, "/chat/messages/search?q=enhance-test"),
            headers=h,
        )
        if search.status_code == 200:
            hits = search.json().get("data") or []
            if any(m.get("id") == message_id for m in hits):
                ok("global message search")
            else:
                fail("global search", f"message not in {len(hits)} hits")
        else:
            fail("global search", f"{search.status_code} {search.text[:200]}")

        # 5. Thread reply -> home replies
        thread = client.post(
            ws_path(ws, f"/chat/channels/{channel_id}/messages/{message_id}/thread"),
            headers=mh,
            json={"body": "thread reply for home test"},
        )
        if thread.status_code not in (200, 201):
            fail("thread reply", f"{thread.status_code} {thread.text[:200]}")
        else:
            ok("thread reply")

        time.sleep(0.5)
        replies = client.get(ws_path(ws, "/home/replies"), headers=h)
        if replies.status_code == 200:
            items = replies.json().get("data") or []
            if any("thread" in (item.get("href") or "") for item in items):
                ok("home replies list (owner notified)")
            elif items:
                ok("home replies list")
            else:
                fail("home replies", "empty after thread reply to owner message")
        else:
            fail("home replies", f"{replies.status_code} {replies.text[:200]}")

        thread_bundle = client.get(
            ws_path(ws, f"/chat/channels/{channel_id}/messages/{message_id}/thread"),
            headers=h,
        )
        if thread_bundle.status_code == 200 and thread_bundle.json().get("hasNew") is True:
            ok("thread hasNew for parent author")
        else:
            fail("thread hasNew", thread_bundle.text[:200])

        # 6. Read receipts (member reads channel)
        client.post(ws_path(ws, f"/chat/channels/{channel_id}/read"), headers=mh)
        page_after_read = client.get(
            ws_path(ws, f"/chat/channels/{channel_id}/messages?limit=10"),
            headers=h,
        )
        if page_after_read.status_code == 200:
            msgs = page_after_read.json().get("data") or []
            owner_msgs = [m for m in msgs if m.get("isSelf")]
            if owner_msgs and any(m.get("readByUserIds") for m in owner_msgs):
                ok("read receipts on messages")
            else:
                fail("read receipts", "readByUserIds missing on owner messages")
        else:
            fail("read receipts fetch", page_after_read.text[:200])

        # 7. DM favorite & hide
        members = client.get(ws_path(ws, "/members"), headers=h)
        member_users = [
            m for m in members.json().get("data", []) if m["email"] == MEMBER[0]
        ]
        if not member_users:
            fail("dm setup", "alex not in workspace members")
        else:
            alex_id = member_users[0]["id"]
            dm = client.post(
                ws_path(ws, "/chat/dms"),
                headers=h,
                json={"userIds": [alex_id]},
            )
            if dm.status_code not in (200, 201):
                fail("create dm", dm.text[:200])
            else:
                dm_id = dm.json()["id"]
                fav = client.patch(
                    ws_path(ws, f"/chat/dms/{dm_id}/participant"),
                    headers=mh,
                    json={"starred": True},
                )
                if fav.status_code == 200 and fav.json().get("starred") is True:
                    ok("dm favorite server-side")
                else:
                    fail("dm favorite", fav.text[:200])

                hide = client.patch(
                    ws_path(ws, f"/chat/dms/{dm_id}/participant"),
                    headers=mh,
                    json={"hidden": True},
                )
                if hide.status_code == 200:
                    ok("dm hide server-side")
                else:
                    fail("dm hide", hide.text[:200])

                dms_hidden = client.get(ws_path(ws, "/chat/dms"), headers=mh)
                hidden_ids = [d["id"] for d in dms_hidden.json().get("data", [])]
                if dm_id not in hidden_ids:
                    ok("hidden dm excluded from list")
                else:
                    fail("dm hide list", "still visible")

                unhide_msg = client.post(
                    ws_path(ws, f"/chat/dms/{dm_id}/messages"),
                    headers=h,
                    json={"body": "unhide test"},
                )
                if unhide_msg.status_code in (200, 201):
                    dms_after = client.get(ws_path(ws, "/chat/dms"), headers=mh)
                    visible = [d["id"] for d in dms_after.json().get("data", [])]
                    if dm_id in visible:
                        ok("dm unhide on new message")
                    else:
                        fail("dm unhide", "still hidden after message")
                else:
                    fail("dm unhide message", unhide_msg.text[:200])

        # 8. Group DM rename + members
        all_members = client.get(ws_path(ws, "/members"), headers=h).json().get(
            "data", []
        )
        ids = [m["id"] for m in all_members[:3]]
        if len(ids) >= 2:
            group = client.post(
                ws_path(ws, "/chat/dms"),
                headers=h,
                json={"userIds": ids[1:], "name": "Test Group"},
            )
            if group.status_code in (200, 201):
                gid = group.json()["id"]
                rename = client.patch(
                    ws_path(ws, f"/chat/dms/{gid}"),
                    headers=h,
                    json={"name": "Renamed Group"},
                )
                if rename.status_code == 200 and rename.json().get("name") == "Renamed Group":
                    ok("group dm rename")
                else:
                    fail("group rename", rename.text[:200])

                if len(all_members) >= 4:
                    extra = all_members[3]["id"]
                    added = client.post(
                        ws_path(ws, f"/chat/dms/{gid}/participants"),
                        headers=h,
                        json={"userIds": [extra]},
                    )
                    if added.status_code == 200 and added.json().get("addedUserIds"):
                        ok("group dm add participant")
                    else:
                        fail("group add", added.text[:200])
            else:
                fail("group dm create", group.text[:200])

        # 9. Socket typing + read events
        typing_events: list[dict[str, Any]] = []
        read_events: list[dict[str, Any]] = []
        socket_headers = {"Origin": SOCKET_ORIGIN}

        owner_sio = socketio.Client(reconnection=False)
        member_sio = socketio.Client(reconnection=False)
        owner_sio.on("chat:typing", lambda data: typing_events.append(data))
        owner_sio.on("chat:read", lambda data: read_events.append(data))

        try:
            owner_sio.connect(
                SOCKET_BASE,
                auth={"token": owner_token},
                transports=["polling"],
                headers=socket_headers,
                wait_timeout=20,
            )
            member_sio.connect(
                SOCKET_BASE,
                auth={"token": member_token},
                transports=["polling"],
                headers=socket_headers,
                wait_timeout=20,
            )
            owner_join = owner_sio.call(
                "workspace:join",
                {"workspaceId": ws, "status": "online"},
                timeout=20,
            )
            member_sio.call(
                "workspace:join",
                {"workspaceId": ws, "status": "online"},
                timeout=20,
            )
            if not owner_join or not owner_join.get("ok"):
                fail("socket workspace join", str(owner_join))
            else:
                ok("socket workspace join")

            typing_resp = member_sio.call(
                "chat:typing:start",
                {
                    "workspaceId": ws,
                    "kind": "channel",
                    "conversationId": channel_id,
                },
                timeout=10,
            )
            time.sleep(0.5)
            if typing_resp and typing_resp.get("ok") and any(
                e.get("typing") is True for e in typing_events
            ):
                ok("socket typing broadcast")
            else:
                fail("socket typing", f"resp={typing_resp} events={typing_events}")

            client.post(ws_path(ws, f"/chat/channels/{channel_id}/read"), headers=mh)
            time.sleep(0.5)
            if any(e.get("kind") == "channel" and e.get("userId") for e in read_events):
                ok("socket read receipt broadcast")
            else:
                fail("socket read", f"events={read_events}")
        except Exception as exc:
            fail("socket tests", str(exc))
        finally:
            if owner_sio.connected:
                owner_sio.disconnect()
            if member_sio.connected:
                member_sio.disconnect()

    print(f"\n=== Results: {len(passed)} passed, {len(failures)} failed ===")
    for f in failures:
        print(f"  - {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
