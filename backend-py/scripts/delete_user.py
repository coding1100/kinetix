"""
Delete a Kinetix user by email (cleans invites and common FK rows).

Usage:
  cd backend-py
  python scripts/delete_user.py htrajpoot3998@gmail.com
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import delete, select, text

from app.db.models.chat import (
    ChatChannelMember,
    ChatMessage,
    DirectParticipant,
    MessageReaction,
)
from app.db.models.invite import Invite
from app.db.models.oauth import OAuthAccount, OAuthExchange
from app.db.models.user import PasswordResetToken, RefreshToken, User
from app.db.models.workspace import WorkspaceMember
from app.db.session import get_session_factory


async def delete_user(email: str) -> None:
    factory = get_session_factory()
    async with factory() as session:
        user = await session.scalar(select(User).where(User.email == email.lower()))
        if not user:
            print(f"No user found: {email}")
            return

        uid = user.id
        print(f"Deleting {user.email} ({uid})…")

        await session.execute(delete(Invite).where(Invite.invited_by_id == uid))
        await session.execute(delete(Invite).where(Invite.email == email.lower()))
        await session.execute(delete(WorkspaceMember).where(WorkspaceMember.user_id == uid))
        await session.execute(delete(RefreshToken).where(RefreshToken.user_id == uid))
        await session.execute(delete(OAuthAccount).where(OAuthAccount.user_id == uid))
        await session.execute(delete(OAuthExchange).where(OAuthExchange.user_id == uid))
        await session.execute(
            delete(PasswordResetToken).where(PasswordResetToken.user_id == uid)
        )
        await session.execute(
            delete(ChatChannelMember).where(ChatChannelMember.user_id == uid)
        )
        await session.execute(
            delete(DirectParticipant).where(DirectParticipant.user_id == uid)
        )
        await session.execute(
            delete(MessageReaction).where(MessageReaction.user_id == uid)
        )
        await session.execute(delete(ChatMessage).where(ChatMessage.author_id == uid))
        await session.execute(delete(User).where(User.id == uid))
        await session.commit()
        print("Done.")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/delete_user.py <email>")
        sys.exit(1)
    asyncio.run(delete_user(sys.argv[1].strip().lower()))


if __name__ == "__main__":
    main()
