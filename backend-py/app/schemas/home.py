from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CreatePostBody(BaseModel):
    channel: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=5000)


class CreateTaskBody(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=5000)


class UpdateTaskBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["OPEN", "TODO", "IN_PROGRESS", "DONE"] | None = None
    name: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    due_date: str | None = Field(default=None, alias="dueDate")
    assignee_ids: list[str] | None = Field(default=None, alias="assigneeIds")


class UpdateInboxItemBody(BaseModel):
    unread: bool | None = None
    bucket: Literal["ALL", "LATER"] | None = None


class UpdateSidebarBody(BaseModel):
    config: dict[str, Any]
