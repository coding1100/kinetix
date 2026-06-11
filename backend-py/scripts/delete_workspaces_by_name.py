"""Delete workspaces by exact name (DB CASCADE)."""
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
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute(
        'SELECT id, name FROM "Workspace" WHERE name = ANY(%s) ORDER BY name',
        (NAMES,),
    )
    rows = cur.fetchall()
    if not rows:
        print("No matching workspaces found.")
        conn.close()
        return

    for ws_id, name in rows:
        print(f"Deleting: {name} ({ws_id})")

    ids = [r[0] for r in rows]
    cur.execute('DELETE FROM "Workspace" WHERE id = ANY(%s)', (ids,))
    deleted = cur.rowcount
    conn.commit()

    cur.execute(
        'SELECT name FROM "Workspace" WHERE name = ANY(%s)',
        (NAMES,),
    )
    remaining = cur.fetchall()
    cur.close()
    conn.close()

    print(f"Deleted {deleted} workspace(s).")
    if remaining:
        print("Still present:", [r[0] for r in remaining])
        sys.exit(1)
    print("Verified: all requested workspaces removed.")


if __name__ == "__main__":
    main()
