"""Check if any TaskAttachment rows have a commentId set."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env")
db_url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute(
    """
    SELECT ta.id, ta."fileName", ta."commentId", tc.body
    FROM "TaskAttachment" ta
    LEFT JOIN "TaskComment" tc ON ta."commentId" = tc.id
    WHERE ta."commentId" IS NOT NULL
    ORDER BY ta."createdAt" DESC LIMIT 10
    """
)
rows = cur.fetchall()
if rows:
    for r in rows:
        print(
            f"att={str(r[0])[:8]} file={r[1]} commentId={str(r[2])[:8]} body={repr(str(r[3])[:60])}"
        )
else:
    print("No comment-linked attachments yet — try adding a comment with a file")

cur.execute('SELECT COUNT(*) FROM "TaskAttachment" WHERE "commentId" IS NULL')
unlinked = cur.fetchone()[0]
print(f"Unlinked (task-level) attachments: {unlinked}")

conn.close()
