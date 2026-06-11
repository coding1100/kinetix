from fastapi import APIRouter, status

from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.schemas.workspace import (
    CreateInviteBody,
    CreateWorkspaceBody,
    DeleteWorkspaceBody,
    TransferWorkspaceOwnershipBody,
    UpdateWorkspaceBody,
    UpdateWorkspaceMemberBody,
)
from app.services import invite_service, workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("")
async def list_workspaces(session: DbSession, user: CurrentUserDep):
    """List workspaces for the current user."""
    data = await workspace_service.list_workspaces(session, user.id)
    return {"data": data}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: CreateWorkspaceBody,
    session: DbSession,
    user: CurrentUserDep,
):
    """Create a workspace; caller becomes owner."""
    return await workspace_service.create_workspace(session, user.id, body)


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    """Workspace detail for an active member."""
    return await workspace_service.get_workspace(session, workspace_id, user.id)


@router.patch("/{workspace_id}")
async def update_workspace(
    body: UpdateWorkspaceBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    """Update workspace (owner/admin)."""
    return await workspace_service.update_workspace(
        session, workspace_id, user.id, body.name
    )


@router.delete("/{workspace_id}")
async def delete_workspace(
    body: DeleteWorkspaceBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
):
    """Permanently delete a workspace (owner only)."""
    return await workspace_service.delete_workspace(
        session, workspace_id, user.id, body.confirm_name
    )


@router.post("/{workspace_id}/transfer-ownership")
async def transfer_workspace_ownership(
    body: TransferWorkspaceOwnershipBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
):
    """Transfer workspace ownership to another member (owner only)."""
    return await workspace_service.transfer_workspace_ownership(
        session, workspace_id, user.id, body.new_owner_user_id
    )


@router.get("/{workspace_id}/members")
async def list_members(
    workspace_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    """List active workspace members."""
    data = await workspace_service.list_workspace_members(session, workspace_id)
    return {"data": data}


@router.get("/{workspace_id}/invites")
async def list_invites(
    workspace_id: str,
    session: DbSession,
    ctx: WorkspaceMemberDep,
):
    """List pending workspace invites."""
    return {
        "data": await invite_service.list_workspace_invites(session, workspace_id)
    }


@router.post("/{workspace_id}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: CreateInviteBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    ctx: WorkspaceMemberDep,
):
    """Invite a user by email."""
    return await invite_service.create_invite(
        session, workspace_id, user.id, ctx.role, body
    )


@router.delete("/{workspace_id}/invites/{invite_id}")
async def delete_invite(
    workspace_id: str,
    invite_id: str,
    session: DbSession,
    ctx: WorkspaceMemberDep,
):
    """Cancel a pending invite."""
    return await invite_service.cancel_workspace_invite(
        session, workspace_id, ctx.role, invite_id
    )


@router.post("/{workspace_id}/invites/{invite_id}/resend")
async def resend_invite(
    workspace_id: str,
    invite_id: str,
    session: DbSession,
    ctx: WorkspaceMemberDep,
):
    """Refresh invite link and expiry."""
    return await invite_service.resend_workspace_invite(
        session, workspace_id, ctx.role, invite_id
    )


@router.patch("/{workspace_id}/members/{member_user_id}")
async def patch_member(
    body: UpdateWorkspaceMemberBody,
    workspace_id: str,
    member_user_id: str,
    session: DbSession,
    user: CurrentUserDep,
    ctx: WorkspaceMemberDep,
):
    """Update a member role (owner/admin)."""
    return await workspace_service.update_workspace_member(
        session,
        workspace_id,
        user.id,
        ctx.role,
        member_user_id,
        body,
    )


@router.delete("/{workspace_id}/members/{member_user_id}")
async def delete_member(
    workspace_id: str,
    member_user_id: str,
    session: DbSession,
    user: CurrentUserDep,
    ctx: WorkspaceMemberDep,
):
    """Remove a member from the workspace (owner/admin)."""
    return await workspace_service.remove_workspace_member(
        session, workspace_id, user.id, ctx.role, member_user_id
    )
