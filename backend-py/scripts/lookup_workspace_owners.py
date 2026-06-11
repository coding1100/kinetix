"""Look up workspace owners by name."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

NAMES = sys.argv[1:] or [
    "Transfer WS 1781184724",
    "Transfer WS 1781184790",
    "Transfer WS 1781184936",
]


def main() -> None:
    url = os.environ.get("DIRECT_URL") or os.environ.get("DIRECT_DATABASE_URL")
    if not url:
        print("No DIRECT_URL configured", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT w.id, w.name, u.email, u."fullName", wm.role::text
        FROM "Workspace" w
        JOIN "WorkspaceMember" wm
          ON wm."workspaceId" = w.id
         AND wm.status = 'ACTIVE'
         AND wm.role = 'OWNER'
        JOIN "User" u ON u.id = wm."userId"
        WHERE w.name = ANY(%s)
        ORDER BY w.name
        """,
        (NAMES,),
    )
    rows = cur.fetchall()
    if not rows:
        cur.execute(
            """
            SELECT w.id, w.name, u.email, u."fullName", wm.role::text
            FROM "Workspace" w
            JOIN "WorkspaceMember" wm ON wm."workspaceId" = w.id AND wm.status = 'ACTIVE'
            JOIN "User" u ON u.id = wm."userId"
            WHERE w.name LIKE 'Transfer WS 1781184%%'
            ORDER BY w.name, wm.role
            """
        )
        rows = cur.fetchall()

    if not rows:
        print("No matching workspaces found.")
        return

    for ws_id, name, email, full_name, role in rows:
        print(f"{name}")
        print(f"  id:    {ws_id}")
        print(f"  owner: {full_name} <{email}> ({role})")
        print()

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
