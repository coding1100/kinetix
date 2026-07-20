from pydantic import BaseModel, ConfigDict, Field

from app.db.models.enums import PermissionLevel


class CreateSpaceBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=500)
    is_private: bool = Field(default=False, alias="isPrivate")


class UpdateSpaceBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=500)
    is_private: bool | None = Field(default=None, alias="isPrivate")


class AddSpaceMemberBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    permission_level: PermissionLevel = Field(alias="permissionLevel")


class CreateFolderBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class UpdateFolderBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


class CreateListBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    folder_id: str | None = Field(default=None, alias="folderId")


class UpdateListBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)


class CreateTaskCommentBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(default="", min_length=0, max_length=5000)
    attachment_ids: list[str] | None = Field(
        default=None, alias="attachmentIds", max_length=20
    )
    parent_comment_id: str | None = Field(default=None, alias="parentCommentId")

    @property
    def has_content(self) -> bool:
        return bool(self.body.strip() or self.attachment_ids)


class UpdateTaskCommentBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(min_length=1, max_length=5000)
