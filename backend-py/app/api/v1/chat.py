from fastapi import APIRouter, File, Query, UploadFile, status

from app.deps.auth import CurrentUserDep, DbSession
from app.deps.workspace import WorkspaceMemberDep
from app.schemas.chat import (
    AddChannelMembersBody,
    CreateChannelBody,
    CreateDmBody,
    PresignAttachmentBody,
    SendMessageBody,
    ToggleReactionBody,
    UpdateChannelBody,
    UpdateMessageBody,
    UpdateChannelMemberBody,
)
from app.services import attachment_service, chat_service

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["chat"])


@router.post("/chat/attachments/presign", status_code=status.HTTP_201_CREATED)
async def post_attachment_presign(
    body: PresignAttachmentBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await attachment_service.presign_upload(
        session,
        workspace_id,
        user.id,
        file_name=body.fileName,
        mime_type=body.mimeType,
        size_bytes=body.sizeBytes,
        kind=body.kind,
        context_type=body.context.type,
        context_id=body.context.id,
    )


@router.post("/chat/attachments/{attachment_id}/upload")
async def post_attachment_upload(
    workspace_id: str,
    attachment_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    file: UploadFile = File(...),
):
    data = await file.read()
    return await attachment_service.upload_file_content(
        session,
        workspace_id,
        user.id,
        attachment_id,
        data,
        file.content_type,
    )


@router.post("/chat/attachments/{attachment_id}/complete")
async def post_attachment_complete(
    workspace_id: str,
    attachment_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await attachment_service.complete_upload(
        session, workspace_id, user.id, attachment_id
    )


@router.get("/chat/channels/{channel_id}/files")
async def get_channel_files(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await attachment_service.list_channel_files(
        session, workspace_id, user.id, channel_id
    )


@router.get("/chat/channels")
async def get_channels(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.list_channels(session, workspace_id, user.id)


@router.post("/chat/channels", status_code=status.HTTP_201_CREATED)
async def post_channel(
    body: CreateChannelBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.create_channel(
        session, workspace_id, user.id, body
    )


@router.get("/chat/channels/{channel_id}")
async def get_channel(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.get_channel(
        session, workspace_id, user.id, channel_id
    )


@router.patch("/chat/channels/{channel_id}")
async def patch_channel(
    body: UpdateChannelBody,
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.update_channel(
        session, workspace_id, user.id, channel_id, body
    )


@router.delete("/chat/channels/{channel_id}")
async def delete_channel(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.delete_channel(
        session, workspace_id, user.id, channel_id
    )


@router.get("/chat/channels/{channel_id}/members")
async def get_channel_members(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.list_channel_members(
        session, workspace_id, user.id, channel_id
    )


@router.post(
    "/chat/channels/{channel_id}/members",
    status_code=status.HTTP_201_CREATED,
)
async def post_channel_members(
    body: AddChannelMembersBody,
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.add_channel_members(
        session, workspace_id, user.id, channel_id, body
    )


@router.delete("/chat/channels/{channel_id}/members/{member_user_id}")
async def delete_channel_member(
    workspace_id: str,
    channel_id: str,
    member_user_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.remove_channel_member(
        session, workspace_id, user.id, channel_id, member_user_id
    )


@router.patch("/chat/channels/{channel_id}/member")
async def patch_channel_member(
    body: UpdateChannelMemberBody,
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.update_channel_member(
        session, workspace_id, user.id, channel_id, body
    )


@router.patch("/chat/channels/{channel_id}/members/{member_user_id}")
async def patch_channel_member_by_id(
    body: UpdateChannelMemberBody,
    workspace_id: str,
    channel_id: str,
    member_user_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.update_channel_member_target(
        session, workspace_id, user.id, channel_id, member_user_id, body
    )


@router.get("/chat/channels/{channel_id}/messages/search")
async def get_channel_message_search(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    q: str = Query("", alias="q"),
):
    return await chat_service.search_channel_messages(
        session, workspace_id, user.id, channel_id, q
    )


@router.get("/chat/channels/{channel_id}/messages")
async def get_channel_messages(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.list_channel_messages(
        session, workspace_id, user.id, channel_id
    )


@router.post("/chat/channels/{channel_id}/read")
async def post_channel_read(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.mark_channel_read(
        session, workspace_id, user.id, channel_id
    )


@router.post("/chat/channels/{channel_id}/unread")
async def post_channel_unread(
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.mark_channel_unread(
        session, workspace_id, user.id, channel_id
    )


@router.post("/chat/channels/{channel_id}/messages", status_code=status.HTTP_201_CREATED)
async def post_channel_message(
    body: SendMessageBody,
    workspace_id: str,
    channel_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.send_channel_message(
        session,
        workspace_id,
        user.id,
        channel_id,
        body.body,
        body.attachmentIds,
    )


@router.get("/chat/channels/{channel_id}/messages/{message_id}/thread")
async def get_channel_thread(
    workspace_id: str,
    channel_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.get_message_thread(
        session, workspace_id, user.id, channel_id, message_id
    )


@router.post(
    "/chat/channels/{channel_id}/messages/{message_id}/thread",
    status_code=status.HTTP_201_CREATED,
)
async def post_channel_thread(
    body: SendMessageBody,
    workspace_id: str,
    channel_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.send_thread_reply(
        session,
        workspace_id,
        user.id,
        channel_id,
        None,
        message_id,
        body.body,
        body.attachmentIds,
    )


@router.get("/chat/dms")
async def get_dms(
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.list_dms(session, workspace_id, user.id)


@router.post("/chat/dms", status_code=status.HTTP_201_CREATED)
async def post_dm(
    body: CreateDmBody,
    workspace_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.create_or_get_dm(
        session, workspace_id, user.id, body.userIds, body.name
    )


@router.get("/chat/dms/{conversation_id}")
async def get_dm(
    workspace_id: str,
    conversation_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.get_dm(
        session, workspace_id, user.id, conversation_id
    )


@router.get("/chat/dms/{conversation_id}/messages/search")
async def get_dm_message_search(
    workspace_id: str,
    conversation_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
    q: str = Query("", alias="q"),
):
    return await chat_service.search_dm_messages(
        session, workspace_id, user.id, conversation_id, q
    )


@router.get("/chat/dms/{conversation_id}/messages")
async def get_dm_messages(
    workspace_id: str,
    conversation_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.list_dm_messages(
        session, workspace_id, user.id, conversation_id
    )


@router.post("/chat/dms/{conversation_id}/read")
async def post_dm_read(
    workspace_id: str,
    conversation_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.mark_dm_read(
        session, workspace_id, user.id, conversation_id
    )


@router.post("/chat/dms/{conversation_id}/unread")
async def post_dm_unread(
    workspace_id: str,
    conversation_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.mark_dm_unread(
        session, workspace_id, user.id, conversation_id
    )


@router.post(
    "/chat/dms/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
async def post_dm_message(
    body: SendMessageBody,
    workspace_id: str,
    conversation_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.send_dm_message(
        session,
        workspace_id,
        user.id,
        conversation_id,
        body.body,
        body.attachmentIds,
    )


@router.get("/chat/dms/{conversation_id}/messages/{message_id}/thread")
async def get_dm_thread(
    workspace_id: str,
    conversation_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.get_dm_message_thread(
        session, workspace_id, user.id, conversation_id, message_id
    )


@router.post(
    "/chat/dms/{conversation_id}/messages/{message_id}/thread",
    status_code=status.HTTP_201_CREATED,
)
async def post_dm_thread(
    body: SendMessageBody,
    workspace_id: str,
    conversation_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.send_thread_reply(
        session,
        workspace_id,
        user.id,
        None,
        conversation_id,
        message_id,
        body.body,
        body.attachmentIds,
    )


@router.patch("/chat/messages/{message_id}")
async def patch_message(
    body: UpdateMessageBody,
    workspace_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.update_message(
        session,
        workspace_id,
        user.id,
        message_id,
        body.body,
        body.attachment_ids,
    )


@router.delete("/chat/messages/{message_id}")
async def delete_message(
    workspace_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.delete_message(
        session, workspace_id, user.id, message_id
    )


@router.post("/chat/messages/{message_id}/reactions")
async def toggle_message_reaction(
    body: ToggleReactionBody,
    workspace_id: str,
    message_id: str,
    session: DbSession,
    user: CurrentUserDep,
    _member: WorkspaceMemberDep,
):
    return await chat_service.toggle_message_reaction(
        session, workspace_id, user.id, message_id, body.emoji
    )
