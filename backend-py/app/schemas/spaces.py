from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.db.models.enums import PermissionLevel, StatusGroup


class StatusConfigItemBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=60)
    color: str = Field(min_length=1, max_length=32)
    status_group: StatusGroup = Field(alias="statusGroup")
    legacy_key: str | None = Field(default=None, alias="legacyKey", max_length=32)


def _validate_status_config(items: list[StatusConfigItemBody] | None) -> None:
    if items is None:
        return
    if not items:
        raise ValueError("statusConfig must include at least one status")
    names = [item.name.strip().lower() for item in items]
    if len(names) != len(set(names)):
        raise ValueError("statusConfig has duplicate status names")


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
    status_config: list[StatusConfigItemBody] | None = Field(
        default=None, alias="statusConfig"
    )

    @model_validator(mode="after")
    def _check_status_config(self) -> "UpdateSpaceBody":
        _validate_status_config(self.status_config)
        return self


class ShareMemberBody(BaseModel):
    """Shared "add a member" body for Space/Folder/List share grants.

    Exactly one of user_id/email must be set: user_id shares with an
    existing active workspace member directly; email shares with someone
    who only has a pending workspace Invite so far — see
    folder_list_permissions.resolve_share_target.
    """

    model_config = ConfigDict(populate_by_name=True)

    user_id: str | None = Field(default=None, alias="userId")
    email: EmailStr | None = Field(default=None)
    permission_level: PermissionLevel = Field(alias="permissionLevel")

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "ShareMemberBody":
        if bool(self.user_id) == bool(self.email):
            raise ValueError("Provide exactly one of userId or email")
        return self


class CreateFolderBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    is_private: bool = Field(default=False, alias="isPrivate")


class UpdateFolderBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_private: bool | None = Field(default=None, alias="isPrivate")


class CreateListBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=120)
    folder_id: str | None = Field(default=None, alias="folderId")
    is_private: bool = Field(default=False, alias="isPrivate")


class UpdateListBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_private: bool | None = Field(default=None, alias="isPrivate")
    status_config: list[StatusConfigItemBody] | None = Field(
        default=None, alias="statusConfig"
    )
    # True reverts this List back to inheriting its Space's statusConfig
    # (clears the override). Ignored if status_config is also set.
    inherit_status_config: bool | None = Field(
        default=None, alias="inheritStatusConfig"
    )

    @model_validator(mode="after")
    def _check_status_config(self) -> "UpdateListBody":
        _validate_status_config(self.status_config)
        return self


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
