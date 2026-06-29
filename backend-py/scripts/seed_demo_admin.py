"""Create or update admin@demo.com in the Acme Demo workspace (ADMIN role).

Usage:
  cd backend-py
  uv run python scripts/seed_demo_admin.py
"""

from __future__ import annotations

import asyncio
import uuid

from dotenv import load_dotenv

load_dotenv(".env")

ADMIN_EMAIL = "admin@demo.com"
ADMIN_PASSWORD = "password123"
ADMIN_NAME = "Admin Demo"
OWNER_EMAIL = "owner@demo.com"
WORKSPACE_NAME = "Acme Demo"


async def main() -> None:
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.db.models.enums import MemberStatus, WorkspaceRole
    from app.db.models.user import User
    from app.db.models.workspace import Workspace, WorkspaceMember
    from app.db.session import get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        workspace = await session.scalar(
            select(Workspace).where(Workspace.name == WORKSPACE_NAME)
        )
        if not workspace:
            owner = await session.scalar(select(User).where(User.email == OWNER_EMAIL))
            if not owner:
                raise SystemExit(
                    f"Workspace '{WORKSPACE_NAME}' not found and {OWNER_EMAIL} missing."
                )
            membership = await session.scalar(
                select(WorkspaceMember)
                .where(
                    WorkspaceMember.user_id == owner.id,
                    WorkspaceMember.status == MemberStatus.ACTIVE,
                    WorkspaceMember.role == WorkspaceRole.OWNER,
                )
                .limit(1)
            )
            if not membership:
                raise SystemExit(f"No owner workspace found for {OWNER_EMAIL}.")
            workspace = await session.get(Workspace, membership.workspace_id)
            if not workspace:
                raise SystemExit("Owner workspace row missing.")

        user = await session.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
                full_name=ADMIN_NAME,
            )
            session.add(user)
            await session.flush()
            print(f"Created user {ADMIN_EMAIL}")
        else:
            user.password_hash = hash_password(ADMIN_PASSWORD)
            user.full_name = ADMIN_NAME
            print(f"Updated user {ADMIN_EMAIL}")

        membership = await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace.id,
                WorkspaceMember.user_id == user.id,
            )
        )
        if not membership:
            session.add(
                WorkspaceMember(
                    id=str(uuid.uuid4()),
                    workspace_id=workspace.id,
                    user_id=user.id,
                    role=WorkspaceRole.ADMIN,
                    status=MemberStatus.ACTIVE,
                )
            )
            print(f"Added to workspace '{workspace.name}' as ADMIN")
        else:
            membership.role = WorkspaceRole.ADMIN
            membership.status = MemberStatus.ACTIVE
            print(f"Updated membership in '{workspace.name}' to ADMIN")

        await session.commit()

    print()
    print("Demo admin ready:")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print(f"  Role:     ADMIN")
    print(f"  Workspace: {WORKSPACE_NAME}")


if __name__ == "__main__":
    asyncio.run(main())
