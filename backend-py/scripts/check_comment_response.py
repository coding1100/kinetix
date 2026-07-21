"""Verify comment-linked attachment appears in map_task output using sync DB."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env")
db_url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Find comment that has linked attachments
cur.execute(
    """
    SELECT tc.id, tc."taskId", tc.body, tc."userId",
           ta.id as att_id, ta."fileName", ta.status, ta."commentId"
    FROM "TaskComment" tc
    JOIN "TaskAttachment" ta ON ta."commentId" = tc.id
    WHERE ta."commentId" IS NOT NULL
    LIMIT 5
    """
)
rows = cur.fetchall()
if rows:
    print(f"Found {len(rows)} comment-attachment links:")
    for r in rows:
        print(f"  comment={r[0][:8]}... task={r[1][:8]}... body={repr(r[2][:40])}")
        print(f"    attachment={r[4][:8]}... file={r[5]} status={r[6]} commentId={r[7][:8]}...")
else:
    print("No comment-linked attachments found")

conn.close()
