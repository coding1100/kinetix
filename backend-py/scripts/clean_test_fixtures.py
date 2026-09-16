import asyncio
import sys
from pathlib import Path
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db.session import get_engine

async def clean_test_fixtures(dry_run: bool = True):
    e = get_engine()
    async with e.connect() as c:
        print(f"=== TEST FIXTURES & DATA CLEANUP (dry_run={dry_run}) ===")

        # 1. Orphaned list channels (isListPrimary=True, listId IS NULL)
        orphaned_channels = (await c.execute(text("""
            SELECT id, name FROM "ChatChannel"
            WHERE "isListPrimary" = TRUE AND "listId" IS NULL
        """))).fetchall()
        print(f"1. Orphaned list channels found: {len(orphaned_channels)}")

        # 2. Transient test workspaces
        test_ws = (await c.execute(text("""
            SELECT id, name FROM "Workspace"
            WHERE (name ~ '[0-9]{8,}' OR name = 'A')
              AND id != 'd7e56376-7db3-4e7c-8061-0c82085b1e4e'
        """))).fetchall()
        print(f"2. Transient test workspaces found: {len(test_ws)}")

        # 3. Transient test spaces in primary workspace
        test_spaces = (await c.execute(text("""
            SELECT id, name FROM "Space"
            WHERE "workspaceId" = 'd7e56376-7db3-4e7c-8061-0c82085b1e4e'
              AND (
                  name ~ '[0-9]{8,}'
                  OR name ~ '^[0-9a-f]{8}$'
                  OR name ILIKE '%test space%'
                  OR name ILIKE 'time space%'
                  OR name ILIKE 'task space%'
                  OR name ILIKE 'limited test space%'
                  OR name ILIKE 'guest test space%'
                  OR name ILIKE 'private test space%'
                  OR name ILIKE 'private list-share space%'
              )
              AND name NOT IN ('Personal', 'Test', 'Strict Private Space')
        """))).fetchall()
        print(f"3. Transient test spaces found in primary workspace: {len(test_spaces)}")

        if not dry_run:
            # Delete orphaned list channels
            if orphaned_channels:
                del_ch = (await c.execute(text("""
                    DELETE FROM "ChatChannel"
                    WHERE "isListPrimary" = TRUE AND "listId" IS NULL
                """))).rowcount
                print(f"  -> Deleted {del_ch} orphaned list channels")

            # Delete transient test spaces (CASCADE deletes their lists, tasks, statuses, etc.)
            if test_spaces:
                space_ids = [s[0] for s in test_spaces]
                del_sp = (await c.execute(text("""
                    DELETE FROM "Space"
                    WHERE id = ANY(:ids)
                """), {"ids": space_ids})).rowcount
                print(f"  -> Deleted {del_sp} transient test spaces")

            # Delete transient test workspaces (CASCADE deletes all child objects)
            if test_ws:
                ws_ids = [w[0] for w in test_ws]
                del_ws = (await c.execute(text("""
                    DELETE FROM "Workspace"
                    WHERE id = ANY(:ids)
                """), {"ids": ws_ids})).rowcount
                print(f"  -> Deleted {del_ws} transient test workspaces")

            await c.commit()
            print("Successfully committed cleanup!")

    await e.dispose()

if __name__ == "__main__":
    dry = "--apply" not in sys.argv
    asyncio.run(clean_test_fixtures(dry_run=dry))
