"""In-process test: alex can delete Members channel."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from starlette.testclient import TestClient

from app.main import app

EMAIL = "alex@demo.com"
PASSWORD = "password123"
CHANNEL_NEEDLE = "members channel"


def main() -> int:
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        assert login.status_code == 200, login.text
        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}
        me = client.get("/api/v1/auth/me", headers=headers)
        user_id = me.json()["id"]
        ws = me.json()["workspaces"][0]["id"]

        channels = client.get(
            f"/api/v1/workspaces/{ws}/chat/channels", headers=headers
        )
        assert channels.status_code == 200, channels.text
        match = next(
            (
                c
                for c in channels.json()["data"]
                if CHANNEL_NEEDLE in c["name"].lower()
            ),
            None,
        )
        if not match:
            print("No Members channel — creating test channel")
            create = client.post(
                f"/api/v1/workspaces/{ws}/chat/channels",
                headers=headers,
                json={"name": f"members channel delete test", "isPrivate": False},
            )
            assert create.status_code == 201, create.text
            match = create.json()
            cid = match["id"]
            print("created", cid, "createdById", match.get("createdById"))
            print("canDelete", match.get("canDelete"))
        else:
            cid = match["id"]
            print("found", match["name"], cid)
            print("list canDelete", match.get("canDelete"), "createdById", match.get("createdById"))

        detail = client.get(
            f"/api/v1/workspaces/{ws}/chat/channels/{cid}", headers=headers
        )
        assert detail.status_code == 200, detail.text
        body = detail.json()
        print("detail canDelete", body.get("canDelete"), "createdById", body.get("createdById"))
        assert body.get("canDelete") is True, body
        assert body.get("createdById") == user_id or body.get("canDelete"), body

        delete = client.delete(
            f"/api/v1/workspaces/{ws}/chat/channels/{cid}", headers=headers
        )
        print("delete", delete.status_code, delete.text)
        assert delete.status_code == 200, delete.text
        print("SUCCESS")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
