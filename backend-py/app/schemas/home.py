from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CreatePostBody(BaseModel):
    channel: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=5000)


class CreateTaskBody(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=5000)


class CreateSubtaskBody(BaseModel):
    name: str = Field(min_length=1, max_length=500)


class PresignTaskAttachmentBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_name: str = Field(min_length=1, max_length=255, alias="fileName")
    mime_type: str = Field(min_length=1, max_length=120, alias="mimeType")
    size_bytes: int = Field(gt=0, alias="sizeBytes")


class UpdateTaskBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["OPEN", "TODO", "IN_PROGRESS", "DONE"] | None = None
    name: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    due_date: str | None = Field(default=None, alias="dueDate")
    assignee_ids: list[str] | None = Field(default=None, alias="assigneeIds")
    priority: Literal["urgent", "high", "normal", "low"] | None = None
    list_id: str | None = Field(default=None, alias="listId")
    status_id: str | None = Field(default=None, alias="statusId")


class UpdateInboxItemBody(BaseModel):
    unread: bool | None = None
    bucket: Literal["ALL", "LATER"] | None = None


class UpdateSidebarBody(BaseModel):
    config: dict[str, Any]


class CreateReminderBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=200)
    due_at: str | None = Field(default=None, alias="dueAt")


class CreateFavoriteBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=200)
    item_type: str = Field(min_length=1, max_length=40, alias="itemType")
    href: str = Field(min_length=1, max_length=500)


class RecordRecentBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=200)
    item_type: str = Field(min_length=1, max_length=40, alias="itemType")
    space: str = Field(default="", max_length=120)
    href: str = Field(min_length=1, max_length=500)


class AddLineupBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId")


class ReorderLineupBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_ids: list[str] = Field(min_length=1, alias="taskIds")
