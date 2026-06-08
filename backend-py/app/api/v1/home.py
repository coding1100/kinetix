from fastapi import APIRouter, Query, status

from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.schemas.home import (
    CreatePostBody,
    CreateTaskBody,
    UpdateInboxItemBody,
    UpdateSidebarBody,
    UpdateTaskBody,
)
from app.schemas.spaces import (
    CreateFolderBody,
    CreateListBody,
    CreateSpaceBody,
    CreateTaskCommentBody,
    UpdateFolderBody,
    UpdateListBody,
    UpdateSpaceBody,
)
from app.services import home_service, spaces_service

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["home"])


@router.get("/home/inbox")
async def get_inbox(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    tab: str = Query("all"),
):
    return await home_service.list_inbox(session, workspace_id, user.id, tab)


@router.patch("/home/inbox/{item_id}")
async def patch_inbox_item(
    body: UpdateInboxItemBody,
    workspace_id: str,
    item_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.update_inbox_item(
        session, workspace_id, user.id, item_id, body
    )


@router.get("/home/replies")
async def get_replies(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_replies(session, workspace_id, user.id)


@router.get("/home/assigned-comments")
async def get_assigned_comments(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_assigned_comments(
        session, workspace_id, user.id
    )


@router.patch("/home/assigned-comments/{comment_id}/resolve")
async def resolve_assigned_comment(
    workspace_id: str,
    comment_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.resolve_assigned_comment(
        session, workspace_id, user.id, comment_id
    )


@router.get("/home/chat-activity")
async def get_chat_activity(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    kind: str | None = Query(None),
):
    return await home_service.list_chat_activity(
        session, workspace_id, user.id, kind
    )


@router.get("/home/drafts-sent")
async def get_drafts_sent(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    tab: str = Query("drafts"),
):
    return await home_service.list_drafts_sent(
        session, workspace_id, user.id, tab
    )


@router.get("/home/reminders")
async def get_reminders(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_reminders(session, workspace_id, user.id)


@router.get("/home/favorites")
async def get_favorites(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_favorites(session, workspace_id, user.id)


@router.get("/home/recents")
async def get_recents(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_recents(session, workspace_id, user.id)


@router.get("/home/notifications")
async def get_notifications(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    limit: int = Query(50, ge=1, le=100),
):
    return await home_service.list_notifications(
        session, workspace_id, user.id, limit
    )


@router.get("/home/unread-summary")
async def get_unread_summary(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.get_unread_summary(
        session, workspace_id, user.id
    )


@router.get("/home/sidebar")
async def get_sidebar(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.get_sidebar_config(
        session, workspace_id, user.id
    )


@router.patch("/home/sidebar")
async def patch_sidebar(
    body: UpdateSidebarBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.update_sidebar_config(
        session, workspace_id, user.id, body.config
    )


@router.get("/spaces")
async def get_spaces(
    workspace_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_spaces(session, workspace_id)


@router.post("/spaces", status_code=status.HTTP_201_CREATED)
async def post_space(
    body: CreateSpaceBody,
    workspace_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.create_space(session, workspace_id, body)


@router.patch("/spaces/{space_id}")
async def patch_space(
    body: UpdateSpaceBody,
    workspace_id: str,
    space_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.update_space(session, workspace_id, space_id, body)


@router.delete("/spaces/{space_id}")
async def delete_space(
    workspace_id: str,
    space_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.delete_space(session, workspace_id, space_id)


@router.post(
    "/spaces/{space_id}/folders",
    status_code=status.HTTP_201_CREATED,
)
async def post_folder(
    body: CreateFolderBody,
    workspace_id: str,
    space_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.create_folder(
        session, workspace_id, space_id, body
    )


@router.patch("/folders/{folder_id}")
async def patch_folder(
    body: UpdateFolderBody,
    workspace_id: str,
    folder_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.update_folder(
        session, workspace_id, folder_id, body
    )


@router.delete("/folders/{folder_id}")
async def delete_folder(
    workspace_id: str,
    folder_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.delete_folder(session, workspace_id, folder_id)


@router.get("/spaces/{space_id}")
async def get_space(
    workspace_id: str,
    space_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await home_service.get_space(session, workspace_id, space_id)


@router.post(
    "/spaces/{space_id}/lists",
    status_code=status.HTTP_201_CREATED,
)
async def post_list(
    body: CreateListBody,
    workspace_id: str,
    space_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.create_list(
        session, workspace_id, space_id, body
    )


@router.patch("/lists/{list_id}")
async def patch_list_meta(
    body: UpdateListBody,
    workspace_id: str,
    list_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.update_list(
        session, workspace_id, list_id, body
    )


@router.delete("/lists/{list_id}")
async def delete_list_meta(
    workspace_id: str,
    list_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.delete_list(session, workspace_id, list_id)


@router.get("/lists/{list_id}")
async def get_list(
    workspace_id: str,
    list_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await home_service.get_list(session, workspace_id, list_id)


@router.get("/lists/{list_id}/tasks")
async def get_list_tasks(
    workspace_id: str,
    list_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_tasks_for_list(
        session, workspace_id, user.id, list_id
    )


@router.post("/lists/{list_id}/tasks", status_code=status.HTTP_201_CREATED)
async def post_list_task(
    body: CreateTaskBody,
    workspace_id: str,
    list_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.create_task(
        session, workspace_id, user.id, list_id, body
    )


@router.get("/tasks")
async def get_tasks(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    filter: str | None = Query(None, alias="filter"),
    search: str | None = Query(None),
):
    return await home_service.list_tasks(
        session, workspace_id, user.id, filter, search
    )


@router.get("/tasks/{task_id}")
async def get_task(
    workspace_id: str,
    task_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.get_task(
        session, workspace_id, user.id, task_id
    )


@router.post(
    "/tasks/{task_id}/comments",
    status_code=status.HTTP_201_CREATED,
)
async def post_task_comment(
    body: CreateTaskCommentBody,
    workspace_id: str,
    task_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await spaces_service.add_task_comment(
        session, workspace_id, user.id, task_id, body
    )


@router.patch("/tasks/{task_id}")
async def patch_task(
    body: UpdateTaskBody,
    workspace_id: str,
    task_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.update_task(
        session, workspace_id, user.id, task_id, body
    )


@router.get("/posts")
async def get_posts(
    workspace_id: str,
    session: DbSession,
    _member: WorkspaceMemberDep,
):
    return await home_service.list_posts(session, workspace_id)


@router.post("/posts", status_code=status.HTTP_201_CREATED)
async def post_create(
    body: CreatePostBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await home_service.create_post(
        session, workspace_id, user.id, body
    )
