import argparse
import asyncio
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.db.models.user import User
from app.core.security import hash_password


async def reset_password(db_url: str, email: str, new_password: str):
    email_clean = email.lower().strip()
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    target_host = db_url.split("@")[-1] if "@" in db_url else db_url
    print(f"Connecting to database target: {target_host}")
    engine = create_async_engine(db_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        user = await session.scalar(select(User).where(User.email == email_clean))
        hashed = hash_password(new_password)

        if not user:
            print(f"User {email_clean} not found. Creating user account...")
            user = User(
                email=email_clean,
                password_hash=hashed,
                full_name=email_clean.split("@")[0].title(),
            )
            session.add(user)
            await session.commit()
            print(f"SUCCESS: Created user {email_clean} with password {new_password}!")
        else:
            user.password_hash = hashed
            await session.commit()
            print(f"SUCCESS: Updated password for user {email_clean}!")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset user password in database.")
    parser.add_argument("--email", default="inam@mindrind.net", help="User email")
    parser.add_argument("--password", default="Inam12345@", help="New password")
    parser.add_argument(
        "--db-url", default="", help="Database connection URL"
    )

    args = parser.parse_args()
    db_url = args.db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        from app.config import get_settings

        db_url = get_settings().async_database_url

    asyncio.run(reset_password(db_url, args.email, args.password))
