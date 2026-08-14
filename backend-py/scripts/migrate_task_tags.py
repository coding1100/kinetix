import asyncio
import asyncpg
from app.config import get_settings

async def main():
    settings = get_settings()
    # parse db settings
    conn = await asyncpg.connect(user='postgres', password='postgres', host='127.0.0.1', port=5432, database='riseup')
    try:
        await conn.execute('ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS tags text[] DEFAULT \'{}\'::text[] NOT NULL;')
        print('Successfully added tags column to Task table')
    except Exception as e:
        print('Migration result:', e)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
