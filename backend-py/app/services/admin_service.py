"""Platform admin portal: cross-workspace/user management + audit log.

Thin business-logic layer behind the /api/v1/admin/* routes, following the
same route-delegates-to-service convention as workspace_service.py.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.core.security import (
    sign_access_token,
    verify_password,
    verify_refresh_token,
    verify_token_hash,
)
from app.db.models.enums import MemberStatus, PlatformRole, WorkspaceRole, WorkspaceStatus
from app.db.models.platform import AdminAuditLog, PlatformStaff
from app.db.models.user import RefreshToken, User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.schemas.admin import AdminLoginBody
from app.schemas.workspace import CreateInviteBody, CreateWorkspaceBody
from app.services import auth_service, invite_service, workspace_service
from app.services.auth_service import issue_refresh_for_user
from app.services.platform_permissions import get_platform_role
from app.services.chat_service import sync_list_channel_members_for_workspace
from app.services.personal_space_service import ensure_personal_space
from app.socket.emit import (
    broadcast_account_disabled,
    broadcast_workspace_deleted,
    broadcast_workspace_member_reactivated,
    broadcast_workspace_member_role_updated,
    broadcast_workspace_member_suspended,
    broadcast_workspace_reactivated,
    broadcast_workspace_suspended,
)

DEFAULT_LIMIT = 25
MAX_LIMIT = 100


def _clamp_limit(limit: int) -> int:
    return max(1, min(limit, MAX_LIMIT))


def _admin_user_out(user: User, role) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "role": role.value,
    }


def _add_audit(
    session: AsyncSession,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    metadata: dict | None = None,
) -> None:
    session.add(
        AdminAuditLog(
            actor_user_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata_json=metadata,
        )
    )


# --- Admin auth -------------------------------------------------------


async def admin_login(session: AsyncSession, body: AdminLoginBody) -> dict:
    user = await session.scalar(select(User).where(User.email == body.email))
    if not user or not user.password_hash:
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")
    if not verify_password(body.password, user.password_hash):
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")
    if user.is_disabled:
        raise AppError(401, "ACCOUNT_DISABLED", "This account has been disabled")

    role = await get_platform_role(session, user.id)
    if role is None:
        raise AppError(403, "FORBIDDEN", "Platform staff access required")

    access_token = sign_access_token(sub=str(user.id), email=user.email)
    refresh_token = await issue_refresh_for_user(session, user.id)
    await session.commit()

    return {
        "user": _admin_user_out(user, role),
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }


async def admin_refresh_session(session: AsyncSession, refresh_token: str) -> dict:
    try:
        payload = verify_refresh_token(refresh_token)
    except Exception:
        raise AppError(401, "INVALID_REFRESH", "Invalid refresh token") from None

    user_id = payload["sub"]
    now = datetime.now(timezone.utc)
    rows = (
        await session.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.expires_at > now,
            )
        )
    ).all()

    matched: RefreshToken | None = None
    for row in rows:
        if verify_token_hash(refresh_token, row.token_hash):
            matched = row
            break
    if not matched:
        raise AppError(401, "INVALID_REFRESH", "Refresh token not found or expired")

    user = await session.get(User, user_id)
    if not user or user.is_disabled:
        raise AppError(401, "UNAUTHORIZED", "User not found")

    role = await get_platform_role(session, user_id)
    if role is None:
        raise AppError(403, "FORBIDDEN", "Platform staff access required")

    await session.delete(matched)
    access_token = sign_access_token(sub=str(user.id), email=user.email)
    new_refresh = await issue_refresh_for_user(session, user.id)
    await session.commit()

    return {
        "user": _admin_user_out(user, role),
        "accessToken": access_token,
        "refreshToken": new_refresh,
    }


async def admin_logout(session: AsyncSession, refresh_token: str | None) -> None:
    await auth_service.logout(session, refresh_token)


# --- Workspaces ---------------------------------------------------------


async def create_workspace_admin(
    session: AsyncSession, actor_id: str, body: CreateWorkspaceBody
) -> dict:
    # Staff creating a workspace from the admin portal isn't added as a
    # member - they invite someone else as owner afterward instead.
    ws = await workspace_service.create_workspace(session, actor_id, body, add_owner=False)
    _add_audit(session, actor_id, "workspace.create", "workspace", ws["id"], {"name": ws["name"]})
    await session.commit()
    return ws


async def list_workspaces(
    session: AsyncSession,
    q: str | None,
    limit: int,
    offset: int,
    status: WorkspaceStatus | None = None,
    include_deleted: bool = False,
) -> dict:
    limit = _clamp_limit(limit)
    stmt = select(Workspace)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Workspace.name.ilike(like), Workspace.slug.ilike(like)))
    if include_deleted:
        # Dedicated "trash" view - archived workspaces only, status filter
        # doesn't apply since it's frozen at whatever it was when deleted.
        stmt = stmt.where(Workspace.is_deleted.is_(True))
    else:
        stmt = stmt.where(Workspace.is_deleted.is_(False))
        if status is not None:
            stmt = stmt.where(Workspace.status == status)

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    stmt = stmt.order_by(Workspace.created_at.desc()).limit(limit).offset(offset)
    workspaces = (await session.scalars(stmt)).all()
    ws_ids = [w.id for w in workspaces]

    member_counts: dict[str, int] = {}
    owners: dict[str, WorkspaceMember] = {}
    if ws_ids:
        count_rows = await session.execute(
            select(WorkspaceMember.workspace_id, func.count())
            .where(
                WorkspaceMember.workspace_id.in_(ws_ids),
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .group_by(WorkspaceMember.workspace_id)
        )
        member_counts = dict(count_rows.all())

        owner_rows = (
            await session.scalars(
                select(WorkspaceMember)
                .where(
                    WorkspaceMember.workspace_id.in_(ws_ids),
                    WorkspaceMember.role == WorkspaceRole.OWNER,
                    WorkspaceMember.status == MemberStatus.ACTIVE,
                )
                .options(selectinload(WorkspaceMember.user))
            )
        ).all()
        owners = {m.workspace_id: m for m in owner_rows}

    items = []
    for w in workspaces:
        owner = owners.get(w.id)
        items.append(
            {
                "id": w.id,
                "name": w.name,
                "slug": w.slug,
                "status": w.status.value,
                "isDeleted": w.is_deleted,
                "deletedAt": w.deleted_at.isoformat() if w.deleted_at else None,
                "memberCount": member_counts.get(w.id, 0),
                "owner": (
                    {
                        "id": owner.user.id,
                        "email": owner.user.email,
                        "fullName": owner.user.full_name,
                    }
                    if owner
                    else None
                ),
                "createdAt": w.created_at.isoformat(),
            }
        )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def _get_workspace_or_404(
    session: AsyncSession, workspace_id: str, *, allow_deleted: bool = False
) -> Workspace:
    ws = await session.get(Workspace, workspace_id)
    if not ws or (ws.is_deleted and not allow_deleted):
        raise AppError(404, "NOT_FOUND", "Workspace not found")
    return ws


async def set_workspace_status(
    session: AsyncSession, workspace_id: str, actor_id: str, status: WorkspaceStatus
) -> dict:
    ws = await _get_workspace_or_404(session, workspace_id)
    ws.status = status
    _add_audit(
        session,
        actor_id,
        "workspace.suspend" if status == WorkspaceStatus.SUSPENDED else "workspace.reactivate",
        "workspace",
        workspace_id,
        {"name": ws.name},
    )
    await session.commit()
    if status == WorkspaceStatus.SUSPENDED:
        # Members currently in this workspace get kicked immediately over
        # the socket rather than waiting for their next request to 404 -
        # the request-time enforcement in deps/workspace.py is the real
        # security boundary, this is purely about not leaving an active
        # session stranded until it happens to make another call.
        await broadcast_workspace_suspended(workspace_id=workspace_id)
    else:
        await broadcast_workspace_reactivated(workspace_id=workspace_id)
    return {"id": ws.id, "status": ws.status.value}


async def delete_workspace_admin(
    session: AsyncSession, workspace_id: str, actor_id: str
) -> dict:
    # Soft delete (archive) rather than the hard DELETE
    # workspace_service.delete_workspace does - recoverable via
    # restore_workspace_admin instead of destroying the row outright.
    ws = await _get_workspace_or_404(session, workspace_id)
    ws.is_deleted = True
    ws.deleted_at = datetime.now(timezone.utc)
    _add_audit(session, actor_id, "workspace.delete", "workspace", workspace_id, {"name": ws.name})
    await session.commit()
    # Members currently in this workspace get kicked immediately, same as
    # suspend - request-time enforcement in deps/workspace.py (is_deleted
    # check) is the real boundary, this just avoids a stranded session.
    await broadcast_workspace_deleted(workspace_id=workspace_id)
    return {"ok": True}


async def restore_workspace_admin(
    session: AsyncSession, workspace_id: str, actor_id: str
) -> dict:
    ws = await _get_workspace_or_404(session, workspace_id, allow_deleted=True)
    if not ws.is_deleted:
        raise AppError(400, "VALIDATION_ERROR", "Workspace is not archived")
    ws.is_deleted = False
    ws.deleted_at = None
    _add_audit(session, actor_id, "workspace.restore", "workspace", workspace_id, {"name": ws.name})
    await session.commit()
    return {"id": ws.id, "isDeleted": ws.is_deleted}


async def transfer_ownership_admin(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    new_owner_user_id: str | None = None,
    new_owner_email: str | None = None,
) -> dict:
    ws = await _get_workspace_or_404(session, workspace_id)

    if new_owner_email:
        email = new_owner_email.strip().lower()
        resolved = await session.scalar(select(User).where(func.lower(User.email) == email))
        if not resolved:
            raise AppError(404, "NOT_FOUND", "No user with that email")
        if resolved.is_disabled:
            raise AppError(400, "VALIDATION_ERROR", "That user's account is disabled")
        new_owner_user_id = resolved.id
    elif not new_owner_user_id:
        raise AppError(400, "VALIDATION_ERROR", "newOwnerUserId or newOwnerEmail is required")

    new_owner_user = await session.get(User, new_owner_user_id)
    if not new_owner_user:
        raise AppError(404, "NOT_FOUND", "User not found")

    # Resolve the current owner before touching any membership rows - once
    # the new owner is flushed in with role=OWNER below, a role/status
    # query could otherwise match either row ambiguously.
    current_owner = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == WorkspaceRole.OWNER,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )

    target = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == new_owner_user_id,
        )
    )
    is_new_member = target is None
    if is_new_member:
        # Transferring to someone not yet in the workspace (added by email) -
        # add them straight in rather than requiring a separate invite step
        # first. Role is set below, after the current-owner lookup.
        target = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=new_owner_user_id,
            role=WorkspaceRole.MEMBER,
            status=MemberStatus.ACTIVE,
        )
        session.add(target)
        await session.flush()
    else:
        target.status = MemberStatus.ACTIVE

    previous_owner_user: User | None = None
    if current_owner and current_owner.user_id != new_owner_user_id:
        current_owner.role = WorkspaceRole.ADMIN
        previous_owner_user = await session.get(User, current_owner.user_id)

    if is_new_member:
        await ensure_personal_space(session, workspace_id)

    target.role = WorkspaceRole.OWNER
    transfer_metadata = {
        "workspaceName": ws.name,
        "newOwnerUserId": new_owner_user_id,
        "newOwnerEmail": new_owner_user.email,
        "newOwnerFullName": new_owner_user.full_name,
        "previousOwnerUserId": current_owner.user_id if current_owner else None,
        "previousOwnerEmail": previous_owner_user.email if previous_owner_user else None,
        "previousOwnerFullName": previous_owner_user.full_name if previous_owner_user else None,
    }
    _add_audit(
        session, actor_id, "workspace.transfer_ownership", "workspace", workspace_id, transfer_metadata
    )
    # Also logged against both members involved, so it shows up in their
    # individual Activity tab on the Users page too.
    _add_audit(
        session, actor_id, "workspace.transfer_ownership", "user", new_owner_user_id, transfer_metadata
    )
    if current_owner and current_owner.user_id != new_owner_user_id:
        _add_audit(
            session,
            actor_id,
            "workspace.transfer_ownership",
            "user",
            current_owner.user_id,
            transfer_metadata,
        )
    await session.commit()
    await sync_list_channel_members_for_workspace(session, workspace_id)

    if current_owner and current_owner.user_id != new_owner_user_id:
        await broadcast_workspace_member_role_updated(
            workspace_id=workspace_id,
            user_id=current_owner.user_id,
            role=WorkspaceRole.ADMIN.value,
        )
    await broadcast_workspace_member_role_updated(
        workspace_id=workspace_id, user_id=new_owner_user_id, role=WorkspaceRole.OWNER.value
    )

    return {"ok": True, "newOwnerUserId": new_owner_user_id}


async def list_workspace_members_admin(session: AsyncSession, workspace_id: str) -> list[dict]:
    await _get_workspace_or_404(session, workspace_id)
    # Deliberately its own query rather than reusing workspace_service's
    # list_workspace_members - that one hard-filters to ACTIVE only (right
    # for the in-app member list), but staff need to see and reactivate
    # SUSPENDED members too.
    rows = (
        await session.scalars(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status.in_(
                    [MemberStatus.ACTIVE, MemberStatus.SUSPENDED]
                ),
            )
            .options(selectinload(WorkspaceMember.user))
            .order_by(WorkspaceMember.joined_at.asc())
        )
    ).all()
    return [
        {
            "id": m.user.id,
            "membershipId": m.id,
            "email": m.user.email,
            "fullName": m.user.full_name,
            "isDisabled": m.user.is_disabled,
            "status": m.status.value,
            "role": m.role.value,
        }
        for m in rows
    ]


async def list_workspace_invites_admin(session: AsyncSession, workspace_id: str) -> dict:
    await _get_workspace_or_404(session, workspace_id)
    return {"items": await invite_service.list_workspace_invites(session, workspace_id)}


async def create_workspace_invite_admin(
    session: AsyncSession, workspace_id: str, actor_id: str, body: CreateInviteBody
) -> dict:
    await _get_workspace_or_404(session, workspace_id)
    # Reuses invite_service.create_invite verbatim - it already 409s on
    # ALREADY_MEMBER / ALREADY_INVITED, same dedupe the in-app People page
    # relies on. Staff acts as OWNER here since they aren't a member of
    # this workspace themselves; that's just the permission ceiling passed
    # into can_assign_role, not a real membership.
    result = await invite_service.create_invite(
        session, workspace_id, actor_id, WorkspaceRole.OWNER, body
    )
    _add_audit(
        session,
        actor_id,
        "workspace.invite.create",
        "workspace",
        workspace_id,
        {"email": body.email, "role": body.role.value},
    )
    await session.commit()
    return result


async def cancel_workspace_invite_admin(
    session: AsyncSession, workspace_id: str, actor_id: str, invite_id: str
) -> dict:
    await _get_workspace_or_404(session, workspace_id)
    result = await invite_service.cancel_workspace_invite(
        session, workspace_id, WorkspaceRole.OWNER, invite_id
    )
    _add_audit(
        session,
        actor_id,
        "workspace.invite.cancel",
        "workspace",
        workspace_id,
        {"inviteId": invite_id},
    )
    await session.commit()
    return result


async def resend_workspace_invite_admin(
    session: AsyncSession, workspace_id: str, actor_id: str, invite_id: str
) -> dict:
    await _get_workspace_or_404(session, workspace_id)
    result = await invite_service.resend_workspace_invite(
        session, workspace_id, WorkspaceRole.OWNER, invite_id
    )
    _add_audit(
        session,
        actor_id,
        "workspace.invite.resend",
        "workspace",
        workspace_id,
        {"inviteId": invite_id},
    )
    await session.commit()
    return result


async def update_member_role_admin(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    target_user_id: str,
    new_role: WorkspaceRole,
) -> dict:
    # Ownership changes go through transfer_ownership_admin (keeps a
    # single-owner invariant + the dedicated audit action) instead of this
    # generic role-change endpoint.
    if new_role == WorkspaceRole.OWNER:
        raise AppError(
            400, "VALIDATION_ERROR", "Use transfer ownership to change the workspace owner"
        )

    ws = await _get_workspace_or_404(session, workspace_id)
    target = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
            WorkspaceMember.status == MemberStatus.ACTIVE,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "Member not found")
    if target.role == WorkspaceRole.OWNER:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Use transfer ownership to change the workspace owner's role",
        )

    target_user = await session.get(User, target_user_id)
    old_role = target.role
    target.role = new_role
    # Logged against both the workspace and the user - it's the only way
    # for it to show up in either page's Activity tab, since each one
    # filters by a single (targetType, targetId) pair.
    role_change_metadata = {
        "workspaceId": workspace_id,
        "workspaceName": ws.name,
        "userId": target_user_id,
        "userEmail": target_user.email if target_user else None,
        "userFullName": target_user.full_name if target_user else None,
        "oldRole": old_role.value,
        "newRole": new_role.value,
    }
    _add_audit(
        session,
        actor_id,
        "workspace.member.role_change",
        "workspace",
        workspace_id,
        role_change_metadata,
    )
    _add_audit(
        session,
        actor_id,
        "workspace.member.role_change",
        "user",
        target_user_id,
        role_change_metadata,
    )
    await session.commit()
    # A role change can shift which private Spaces/Lists (and their
    # list-primary chat channels) this member can see - same re-sync
    # workspace_service.update_workspace_member does for the regular
    # in-app role-change path.
    await sync_list_channel_members_for_workspace(session, workspace_id)
    await broadcast_workspace_member_role_updated(
        workspace_id=workspace_id, user_id=target_user_id, role=new_role.value
    )
    return {"id": target.id, "userId": target_user_id, "role": target.role.value}


async def set_member_status_admin(
    session: AsyncSession,
    workspace_id: str,
    actor_id: str,
    target_user_id: str,
    suspended: bool,
) -> dict:
    # Workspace-scoped disable, distinct from set_user_disabled (which is
    # global, account-wide) - flips just this one WorkspaceMember row's
    # status. Enforcement is already in place for free: get_workspace_member
    # (deps/workspace.py) 403s on any non-ACTIVE membership status, and
    # get_me only returns ACTIVE (or, for admin's own view, ACTIVE/SUSPENDED)
    # memberships - a suspended member simply stops seeing/reaching this one
    # workspace, everywhere else is untouched.
    ws = await _get_workspace_or_404(session, workspace_id)
    target = await session.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
        )
    )
    if not target:
        raise AppError(404, "NOT_FOUND", "Member not found")
    if target.role == WorkspaceRole.OWNER:
        raise AppError(
            400, "VALIDATION_ERROR", "Transfer ownership before suspending the owner"
        )

    target_user = await session.get(User, target_user_id)
    target.status = MemberStatus.SUSPENDED if suspended else MemberStatus.ACTIVE
    action = "workspace.member.suspend" if suspended else "workspace.member.reactivate"
    metadata = {
        "workspaceId": workspace_id,
        "workspaceName": ws.name,
        "userId": target_user_id,
        "userEmail": target_user.email if target_user else None,
        "userFullName": target_user.full_name if target_user else None,
    }
    _add_audit(session, actor_id, action, "workspace", workspace_id, metadata)
    _add_audit(session, actor_id, action, "user", target_user_id, metadata)
    await session.commit()
    if suspended:
        # Instant kick if they're currently in this workspace - same
        # reasoning as broadcast_workspace_suspended, just scoped to one
        # member instead of the whole room.
        await broadcast_workspace_member_suspended(
            workspace_id=workspace_id, user_id=target_user_id
        )
    else:
        # Instant un-gray in their workspace switcher instead of waiting
        # for a reload to notice the membership is ACTIVE again.
        await broadcast_workspace_member_reactivated(
            workspace_id=workspace_id, user_id=target_user_id
        )
    return {"userId": target_user_id, "status": target.status.value}


# --- Users ---------------------------------------------------------------


async def list_users(
    session: AsyncSession,
    q: str | None,
    limit: int,
    offset: int,
    is_disabled: bool | None = None,
) -> dict:
    limit = _clamp_limit(limit)
    stmt = select(User)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    if is_disabled is not None:
        stmt = stmt.where(User.is_disabled == is_disabled)

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    stmt = stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
    users = (await session.scalars(stmt)).all()
    user_ids = [u.id for u in users]

    workspace_counts: dict[str, int] = {}
    if user_ids:
        rows = await session.execute(
            select(WorkspaceMember.user_id, func.count())
            .where(
                WorkspaceMember.user_id.in_(user_ids),
                WorkspaceMember.status == MemberStatus.ACTIVE,
            )
            .group_by(WorkspaceMember.user_id)
        )
        workspace_counts = dict(rows.all())

    items = [
        {
            "id": u.id,
            "email": u.email,
            "fullName": u.full_name,
            "isDisabled": u.is_disabled,
            "workspaceCount": workspace_counts.get(u.id, 0),
            "createdAt": u.created_at.isoformat(),
        }
        for u in users
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def list_user_workspaces(session: AsyncSession, user_id: str) -> dict:
    # get_me already returns exactly {id, name, slug, role, status,
    # membershipStatus} per membership, sorted oldest-first — reuse rather
    # than re-querying. include_suspended=True since staff need to see (and
    # reactivate) suspended *workspaces*; include_suspended_memberships=True
    # since staff also need to see (and reactivate) a SUSPENDED *membership*
    # in an otherwise-fine workspace - neither is true for the regular
    # /auth/me path.
    me = await auth_service.get_me(
        session, user_id, include_suspended=True, include_suspended_memberships=True
    )
    return {"items": me["workspaces"]}


async def set_user_disabled(
    session: AsyncSession, user_id: str, actor_id: str, disabled: bool
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "User not found")

    user.is_disabled = disabled
    if disabled:
        await session.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))

    _add_audit(
        session,
        actor_id,
        "user.disable" if disabled else "user.enable",
        "user",
        user_id,
        {"email": user.email, "fullName": user.full_name},
    )
    await session.commit()
    if disabled:
        # Push an instant logout instead of waiting for this user's next
        # request to hit the is_disabled check in get_current_user - same
        # reasoning as the workspace:suspended broadcast.
        await broadcast_account_disabled(user_id=user_id)
    return {"id": user.id, "isDisabled": user.is_disabled}


# --- Platform staff --------------------------------------------------------


async def list_platform_staff(session: AsyncSession) -> dict:
    stmt = (
        select(PlatformStaff)
        .options(selectinload(PlatformStaff.user))
        .order_by(PlatformStaff.created_at.desc())
    )
    rows = (await session.scalars(stmt)).all()

    granter_ids = {row.granted_by for row in rows if row.granted_by}
    granters: dict[str, User] = {}
    if granter_ids:
        granter_rows = (
            await session.scalars(select(User).where(User.id.in_(granter_ids)))
        ).all()
        granters = {u.id: u for u in granter_rows}

    items = [
        {
            "id": row.id,
            "userId": row.user_id,
            "email": row.user.email,
            "fullName": row.user.full_name,
            "role": row.role.value,
            "grantedBy": (
                {
                    "id": row.granted_by,
                    "email": granters[row.granted_by].email,
                    "fullName": granters[row.granted_by].full_name,
                }
                if row.granted_by and row.granted_by in granters
                else None
            ),
            "createdAt": row.created_at.isoformat(),
        }
        for row in rows
    ]
    return {"items": items}


async def grant_platform_staff(session: AsyncSession, actor_id: str, email: str) -> dict:
    normalized = email.strip().lower()
    user = await session.scalar(select(User).where(func.lower(User.email) == normalized))
    if not user:
        raise AppError(404, "NOT_FOUND", "No user with that email")
    if user.is_disabled:
        raise AppError(400, "VALIDATION_ERROR", "That user's account is disabled")

    existing = await session.scalar(
        select(PlatformStaff).where(PlatformStaff.user_id == user.id)
    )
    if existing:
        raise AppError(409, "ALREADY_STAFF", "That user already has platform staff access")

    staff = PlatformStaff(user_id=user.id, role=PlatformRole.STAFF, granted_by=actor_id)
    session.add(staff)
    await session.flush()
    _add_audit(
        session,
        actor_id,
        "platform_staff.grant",
        "user",
        user.id,
        {"email": user.email, "fullName": user.full_name},
    )
    await session.commit()
    return {
        "id": staff.id,
        "userId": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "role": staff.role.value,
    }


async def revoke_platform_staff(session: AsyncSession, actor_id: str, target_user_id: str) -> dict:
    if target_user_id == actor_id:
        raise AppError(400, "VALIDATION_ERROR", "You cannot revoke your own platform staff access")

    staff = await session.scalar(
        select(PlatformStaff).where(PlatformStaff.user_id == target_user_id)
    )
    if not staff:
        raise AppError(404, "NOT_FOUND", "That user is not platform staff")

    user = await session.get(User, target_user_id)
    await session.delete(staff)
    _add_audit(
        session,
        actor_id,
        "platform_staff.revoke",
        "user",
        target_user_id,
        {"email": user.email if user else None, "fullName": user.full_name if user else None},
    )
    await session.commit()
    return {"ok": True}


# --- Audit log -------------------------------------------------------------


async def list_audit_log(
    session: AsyncSession,
    target_type: str | None,
    target_id: str | None,
    limit: int,
    offset: int,
) -> dict:
    limit = _clamp_limit(limit)
    stmt = select(AdminAuditLog)
    if target_type:
        stmt = stmt.where(AdminAuditLog.target_type == target_type)
    if target_id:
        stmt = stmt.where(AdminAuditLog.target_id == target_id)

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    stmt = (
        stmt.options(selectinload(AdminAuditLog.actor))
        .order_by(AdminAuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await session.scalars(stmt)).all()

    items = [
        {
            "id": row.id,
            "action": row.action,
            "targetType": row.target_type,
            "targetId": row.target_id,
            "metadata": row.metadata_json,
            "actor": {
                "id": row.actor.id,
                "email": row.actor.email,
                "fullName": row.actor.full_name,
            },
            "createdAt": row.created_at.isoformat(),
        }
        for row in rows
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}
