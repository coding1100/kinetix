from datetime import datetime, timedelta, timezone

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.errors import AppError
from app.core.security import hash_password, sign_access_token
from app.core.utils import generate_token
from app.db.models.enums import MemberStatus, WorkspaceRole
from app.db.models.invite import Invite
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import CreateInviteBody
from app.services import email_service
from app.services.auth_service import issue_refresh_for_user
from app.services.workspace_service import get_active_member_json
from app.socket.emit import broadcast_workspace_member_joined

_INVITE_ROLES = {
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def create_invite(
    session: AsyncSession,
    workspace_id: str,
    invited_by_id: str,
    inviter_role: WorkspaceRole,
    body: CreateInviteBody,
) -> dict:
    if inviter_role not in _INVITE_ROLES:
        raise AppError(403, "FORBIDDEN", "You cannot invite users to this workspace")

    email = body.email.lower()
    existing_user = await session.scalar(
        select(User).where(User.email == email)
    )
    if existing_user:
        active = await session.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == existing_user.id,
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
        )
        if active:
            raise AppError(409, "ALREADY_MEMBER", "User is already in this workspace")

    settings = get_settings()
    now = _utc_now()
    expires_at = now + timedelta(days=settings.invite_token_expires_days)

    pending = await session.scalar(
        select(Invite).where(
            Invite.workspace_id == workspace_id,
            Invite.email == email,
            Invite.accepted_at.is_(None),
        )
    )
    if pending:
        pending.role = body.role
        pending.token = generate_token()
        pending.expires_at = expires_at
        pending.invited_by_id = invited_by_id
        invite = pending
    else:
        token = generate_token()
        invite = Invite(
            workspace_id=workspace_id,
            email=email,
            role=body.role,
            token=token,
            expires_at=expires_at,
            invited_by_id=invited_by_id,
        )
        session.add(invite)

    await session.flush()
    workspace = await session.get(Workspace, workspace_id)
    inviter = await session.get(User, invited_by_id)
    inviter_name = inviter.full_name if inviter else "A teammate"
    await session.commit()

    return await _invite_payload_with_email(
        invite, workspace, settings, inviter_name
    )


def _invite_payload(
    invite: Invite,
    workspace: Workspace,
    settings,
    *,
    email_sent: bool = False,
) -> dict:
    now = _utc_now()
    expired = _as_utc(invite.expires_at) < now
    invite_url = f"{settings.frontend_url}/invite/accept?token={invite.token}"
    return {
        "id": invite.id,
        "email": invite.email,
        "role": invite.role.value,
        "expiresAt": invite.expires_at.isoformat(),
        "createdAt": invite.created_at.isoformat() if invite.created_at else None,
        "status": "expired" if expired else "pending",
        "workspace": {"id": workspace.id, "name": workspace.name},
        "inviteUrl": invite_url,
        "token": invite.token,
        "emailSent": email_sent,
    }


async def _invite_payload_with_email(
    invite: Invite,
    workspace: Workspace,
    settings,
    inviter_name: str,
) -> dict:
    invite_url = f"{settings.frontend_url}/invite/accept?token={invite.token}"
    email_sent = False
    if email_service.is_smtp_configured():
        try:
            await email_service.send_workspace_invite_email(
                to=invite.email,
                workspace_name=workspace.name,
                inviter_name=inviter_name,
                invite_url=invite_url,
                role=invite.role.value,
            )
            email_sent = True
        except Exception as exc:
            raise AppError(
                502,
                "EMAIL_DELIVERY_FAILED",
                f"Invite was saved but the email could not be sent: {exc}",
            ) from exc
    return _invite_payload(invite, workspace, settings, email_sent=email_sent)


async def list_workspace_invites(
    session: AsyncSession, workspace_id: str
) -> list[dict]:
    settings = get_settings()
    now = _utc_now()
    rows = (
        await session.scalars(
            select(Invite)
            .where(
                Invite.workspace_id == workspace_id,
                Invite.accepted_at.is_(None),
            )
            .options(selectinload(Invite.inviter), selectinload(Invite.workspace))
            .order_by(Invite.created_at.desc())
        )
    ).all()
    workspace = await session.get(Workspace, workspace_id)
    return [
        {
            "id": inv.id,
            "email": inv.email,
            "role": inv.role.value,
            "expiresAt": inv.expires_at.isoformat(),
            "createdAt": inv.created_at.isoformat() if inv.created_at else None,
            "status": "expired" if _as_utc(inv.expires_at) < now else "pending",
            "invitedBy": {
                "id": inv.inviter.id,
                "fullName": inv.inviter.full_name,
            }
            if inv.inviter
            else None,
            "inviteUrl": f"{settings.frontend_url}/invite/accept?token={inv.token}",
        }
        for inv in rows
    ]


async def cancel_workspace_invite(
    session: AsyncSession,
    workspace_id: str,
    actor_role: WorkspaceRole,
    invite_id: str,
) -> dict:
    if actor_role not in _INVITE_ROLES:
        raise AppError(403, "FORBIDDEN", "You cannot manage invites")

    invite = await session.scalar(
        select(Invite).where(
            Invite.id == invite_id,
            Invite.workspace_id == workspace_id,
        )
    )
    if not invite:
        raise AppError(404, "NOT_FOUND", "Invite not found")
    if invite.accepted_at:
        raise AppError(410, "INVITE_USED", "Invite already accepted")

    await session.delete(invite)
    await session.commit()
    return {"ok": True}


async def resend_workspace_invite(
    session: AsyncSession,
    workspace_id: str,
    actor_role: WorkspaceRole,
    invite_id: str,
) -> dict:
    if actor_role not in _INVITE_ROLES:
        raise AppError(403, "FORBIDDEN", "You cannot manage invites")

    invite = await session.scalar(
        select(Invite)
        .where(Invite.id == invite_id, Invite.workspace_id == workspace_id)
        .options(selectinload(Invite.workspace))
    )
    if not invite:
        raise AppError(404, "NOT_FOUND", "Invite not found")
    if invite.accepted_at:
        raise AppError(410, "INVITE_USED", "Invite already accepted")

    settings = get_settings()
    invite.token = generate_token()
    invite.expires_at = _utc_now() + timedelta(days=settings.invite_token_expires_days)
    inviter = await session.get(User, invite.invited_by_id)
    inviter_name = inviter.full_name if inviter else "A teammate"
    await session.commit()
    return await _invite_payload_with_email(
        invite, invite.workspace, settings, inviter_name
    )


async def get_invite_by_token(session: AsyncSession, token: str) -> dict:
    invite = await session.scalar(
        select(Invite)
        .where(Invite.token == token)
        .options(selectinload(Invite.workspace))
    )
    if not invite:
        raise AppError(404, "NOT_FOUND", "Invite not found")
    if invite.accepted_at:
        raise AppError(410, "INVITE_USED", "This invite has already been accepted")
    if _as_utc(invite.expires_at) < _utc_now():
        raise AppError(410, "INVITE_EXPIRED", "This invite has expired")

    ws = invite.workspace
    return {
        "email": invite.email,
        "role": invite.role.value,
        "workspace": {"id": ws.id, "name": ws.name, "slug": ws.slug},
    }


async def accept_invite_for_user(
    session: AsyncSession, token: str, user_id: str
) -> dict:
    invite = await session.scalar(select(Invite).where(Invite.token == token))
    if not invite:
        raise AppError(404, "NOT_FOUND", "Invite not found")
    if invite.accepted_at:
        raise AppError(410, "INVITE_USED", "Invite already used")
    if _as_utc(invite.expires_at) < _utc_now():
        raise AppError(410, "INVITE_EXPIRED", "Invite expired")

    user = await session.get(User, user_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")
    if user.email.lower() != invite.email.lower():
        raise AppError(403, "EMAIL_MISMATCH", "Log in with the invited email address")

    membership = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invite.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if membership:
        membership.role = invite.role
        membership.status = MemberStatus.ACTIVE
    else:
        session.add(
            WorkspaceMember(
                workspace_id=invite.workspace_id,
                user_id=user_id,
                role=invite.role,
                status=MemberStatus.ACTIVE,
            )
        )
    invite.accepted_at = datetime.now(timezone.utc)
    await session.commit()

    member = await get_active_member_json(session, invite.workspace_id, user_id)
    asyncio.create_task(
        broadcast_workspace_member_joined(
            workspace_id=invite.workspace_id,
            member=member,
            invite_email=invite.email,
        )
    )

    workspace = await session.get(Workspace, invite.workspace_id)
    return {
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "slug": workspace.slug,
        },
        "role": invite.role.value,
        "flow": "invitee",
    }


async def accept_invite_with_signup(
    session: AsyncSession, token: str, full_name: str, password: str
) -> dict:
    invite = await session.scalar(select(Invite).where(Invite.token == token))
    if not invite:
        raise AppError(404, "NOT_FOUND", "Invite not found")
    if invite.accepted_at:
        raise AppError(410, "INVITE_USED", "Invite already used")
    if _as_utc(invite.expires_at) < _utc_now():
        raise AppError(410, "INVITE_EXPIRED", "Invite expired")

    existing = await session.scalar(select(User).where(User.email == invite.email))
    if existing:
        raise AppError(
            409, "EMAIL_EXISTS", "Account exists — log in and accept invite"
        )

    user = User(
        email=invite.email,
        password_hash=hash_password(password),
        full_name=full_name,
    )
    session.add(user)
    await session.flush()
    session.add(
        WorkspaceMember(
            workspace_id=invite.workspace_id,
            user_id=user.id,
            role=invite.role,
            status=MemberStatus.ACTIVE,
        )
    )
    invite.accepted_at = datetime.now(timezone.utc)
    await session.commit()

    member = await get_active_member_json(session, invite.workspace_id, user.id)
    asyncio.create_task(
        broadcast_workspace_member_joined(
            workspace_id=invite.workspace_id,
            member=member,
            invite_email=invite.email,
        )
    )

    workspace = await session.get(Workspace, invite.workspace_id)
    access_token = sign_access_token(sub=str(user.id), email=user.email)
    refresh_token = await issue_refresh_for_user(session, user.id)

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "fullName": user.full_name,
            "avatarUrl": user.avatar_url,
        },
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "slug": workspace.slug,
        },
        "role": invite.role.value,
        "flow": "invitee",
    }
