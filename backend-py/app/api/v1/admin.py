from fastapi import APIRouter, Cookie, Query, Response

from app.api.cookies import clear_admin_refresh_cookie, set_admin_refresh_cookie
from app.core.errors import AppError
from app.db.models.enums import WorkspaceStatus
from app.deps.auth import CurrentUserDep, DbSession
from app.deps.platform import PlatformStaffDep
from app.schemas.admin import (
    AdminGrantStaffBody,
    AdminLoginBody,
    AdminRefreshBody,
    AdminTransferOwnershipBody,
    AdminUpdateMemberRoleBody,
)
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/auth/login")
async def admin_login(
    body: AdminLoginBody,
    response: Response,
    session: DbSession,
):
    result = await admin_service.admin_login(session, body)
    refresh_token = result.pop("refreshToken")
    set_admin_refresh_cookie(response, refresh_token)
    return {**result, "refreshToken": refresh_token}


@router.post("/auth/refresh")
async def admin_refresh(
    response: Response,
    session: DbSession,
    body: AdminRefreshBody | None = None,
    riseup_admin_refresh: str | None = Cookie(default=None),
):
    refresh_token = riseup_admin_refresh or (body.refresh_token if body else None)
    if not refresh_token:
        raise AppError(401, "UNAUTHORIZED", "Refresh token missing")
    result = await admin_service.admin_refresh_session(session, refresh_token)
    new_refresh = result.pop("refreshToken")
    set_admin_refresh_cookie(response, new_refresh)
    return {**result, "refreshToken": new_refresh}


@router.post("/auth/logout")
async def admin_logout(
    response: Response,
    session: DbSession,
    riseup_admin_refresh: str | None = Cookie(default=None),
):
    await admin_service.admin_logout(session, riseup_admin_refresh)
    clear_admin_refresh_cookie(response)
    return {"message": "Logged out"}


@router.get("/workspaces")
async def list_workspaces(
    staff: PlatformStaffDep,
    session: DbSession,
    q: str | None = Query(default=None),
    status: WorkspaceStatus | None = Query(default=None),
    includeDeleted: bool = Query(default=False),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await admin_service.list_workspaces(
        session, q, limit, offset, status=status, include_deleted=includeDeleted
    )


@router.post("/workspaces/{workspaceId}/suspend")
async def suspend_workspace(
    workspaceId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.set_workspace_status(
        session, workspaceId, user.id, WorkspaceStatus.SUSPENDED
    )


@router.post("/workspaces/{workspaceId}/reactivate")
async def reactivate_workspace(
    workspaceId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.set_workspace_status(
        session, workspaceId, user.id, WorkspaceStatus.ACTIVE
    )


@router.delete("/workspaces/{workspaceId}")
async def delete_workspace(
    workspaceId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.delete_workspace_admin(session, workspaceId, user.id)


@router.post("/workspaces/{workspaceId}/restore")
async def restore_workspace(
    workspaceId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.restore_workspace_admin(session, workspaceId, user.id)


@router.post("/workspaces/{workspaceId}/transfer-ownership")
async def transfer_ownership(
    workspaceId: str,
    body: AdminTransferOwnershipBody,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.transfer_ownership_admin(
        session,
        workspaceId,
        user.id,
        new_owner_user_id=body.new_owner_user_id,
        new_owner_email=body.new_owner_email,
    )


@router.get("/workspaces/{workspaceId}/members")
async def list_workspace_members(
    workspaceId: str,
    staff: PlatformStaffDep,
    session: DbSession,
):
    return {"items": await admin_service.list_workspace_members_admin(session, workspaceId)}


@router.patch("/workspaces/{workspaceId}/members/{userId}/role")
async def update_member_role(
    workspaceId: str,
    userId: str,
    body: AdminUpdateMemberRoleBody,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.update_member_role_admin(
        session, workspaceId, user.id, userId, body.role
    )


@router.post("/workspaces/{workspaceId}/members/{userId}/suspend")
async def suspend_member(
    workspaceId: str,
    userId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.set_member_status_admin(
        session, workspaceId, user.id, userId, True
    )


@router.post("/workspaces/{workspaceId}/members/{userId}/reactivate")
async def reactivate_member(
    workspaceId: str,
    userId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.set_member_status_admin(
        session, workspaceId, user.id, userId, False
    )


@router.get("/users")
async def list_users(
    staff: PlatformStaffDep,
    session: DbSession,
    q: str | None = Query(default=None),
    isDisabled: bool | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await admin_service.list_users(session, q, limit, offset, is_disabled=isDisabled)


@router.get("/users/{userId}/workspaces")
async def list_user_workspaces(
    userId: str,
    staff: PlatformStaffDep,
    session: DbSession,
):
    return await admin_service.list_user_workspaces(session, userId)


@router.post("/users/{userId}/disable")
async def disable_user(
    userId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.set_user_disabled(session, userId, user.id, True)


@router.post("/users/{userId}/enable")
async def enable_user(
    userId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.set_user_disabled(session, userId, user.id, False)


@router.get("/staff")
async def list_staff(
    staff: PlatformStaffDep,
    session: DbSession,
):
    return await admin_service.list_platform_staff(session)


@router.post("/staff")
async def grant_staff(
    body: AdminGrantStaffBody,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.grant_platform_staff(session, user.id, body.email)


@router.delete("/staff/{userId}")
async def revoke_staff(
    userId: str,
    staff: PlatformStaffDep,
    user: CurrentUserDep,
    session: DbSession,
):
    return await admin_service.revoke_platform_staff(session, user.id, userId)


@router.get("/audit-log")
async def audit_log(
    staff: PlatformStaffDep,
    session: DbSession,
    targetType: str | None = Query(default=None),
    targetId: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return await admin_service.list_audit_log(session, targetType, targetId, limit, offset)
