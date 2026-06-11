from pathlib import Path
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
conn = psycopg2.connect(os.environ["DIRECT_URL"])
cur = conn.cursor()
for t in ("OAuthAccount", "OAuthState", "OAuthExchange"):
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
        (t,),
    )
    print(f"{t}: {cur.fetchone()[0]}")
cur.close()
conn.close()
