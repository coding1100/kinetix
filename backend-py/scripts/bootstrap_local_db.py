"""Create schema and demo users for local hybrid dev (empty Docker Postgres)."""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import models  # noqa: F401 — register ORM models
from app.db.base import Base
from app.db.models.user import User
from app.db.session import get_engine, get_session_factory
from app.schemas.auth import SignupBody
from app.services import auth_service


async def _run_sql_migrations(conn) -> None:
    scripts_dir = Path(__file__).parent
    for name in (
        "migrate_google_oauth.sql",
        "migrate_channel_created_by.sql",
        "create_message_attachments.sql",
        "migrate_chat_enhancements.sql",
    ):
        path = scripts_dir / name
        if not path.exists():
            continue
        raw = path.read_text(encoding="utf-8")
        for block in raw.split(";"):
            lines = [
                line
                for line in block.strip().splitlines()
                if line.strip() and not line.strip().startswith("--")
            ]
            if lines:
                await conn.execute(text("\n".join(lines)))


import uuid
from app.core.security import hash_password
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.workspace import Workspace, WorkspaceMember

async def main() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_sql_migrations(conn)

    factory = get_session_factory()
    async with factory() as session:
        existing = await session.scalar(
            select(User).where(User.email == "owner@demo.com")
        )
        if not existing:
            await auth_service.signup(
                session,
                SignupBody(
                    email="owner@demo.com",
                    password="Password123!",
                    full_name="Owner Demo",
                    workspace_name="Acme Demo",
                ),
            )
            print("Seeded owner@demo.com / Password123! (workspace: Acme Demo)")
        else:
            print("Demo owner user already exists — skipped owner seed")

        existing_alex = await session.scalar(
            select(User).where(User.email == "alex@demo.com")
        )
        if not existing_alex:
            alex = User(
                id=str(uuid.uuid4()),
                email="alex@demo.com",
                password_hash=hash_password("Password123!"),
                full_name="Alex Demo",
            )
            session.add(alex)
            await session.flush()
            ws = await session.scalar(
                select(Workspace).where(Workspace.name == "Acme Demo")
            )
            if ws:
                session.add(
                    WorkspaceMember(
                        id=str(uuid.uuid4()),
                        workspace_id=ws.id,
                        user_id=alex.id,
                        role=WorkspaceRole.MEMBER,
                        status=MemberStatus.ACTIVE,
                    )
                )
            await session.commit()
            print("Seeded alex@demo.com / Password123! (workspace: Acme Demo)")

    print("Local database is ready.")


if __name__ == "__main__":
    asyncio.run(main())
