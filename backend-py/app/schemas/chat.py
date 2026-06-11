from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator


class CreateChannelBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    topic: str | None = Field(default=None, max_length=500)
    isPrivate: bool | None = None
    spaceLabel: str | None = Field(default=None, max_length=120)
    memberIds: list[str] | None = Field(default=None, max_length=50)


class AddChannelMembersBody(BaseModel):
    userIds: list[str] = Field(min_length=1, max_length=50)


class AttachmentContextBody(BaseModel):
    type: Literal["channel", "dm"]
    id: str = Field(min_length=1)


class PresignAttachmentBody(BaseModel):
    fileName: str = Field(min_length=1, max_length=255)
    mimeType: str = Field(min_length=1, max_length=120)
    sizeBytes: int = Field(gt=0)
    kind: Literal["file", "video", "clip", "doc", "audio"] = "file"
    context: AttachmentContextBody


class SendMessageBody(BaseModel):
    body: str = Field(default="", max_length=10000)
    attachmentIds: list[str] | None = Field(default=None, max_length=10)

    @model_validator(mode="after")
    def require_content(self) -> "SendMessageBody":
        has_text = bool(self.body.strip())
        has_files = bool(self.attachmentIds)
        if not has_text and not has_files:
            raise ValueError("Message must include text or attachments")
        return self


class UpdateMessageBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    body: str = Field(default="", max_length=10000)
    attachment_ids: list[str] | None = Field(
        default=None,
        max_length=10,
        validation_alias=AliasChoices("attachmentIds", "attachment_ids"),
    )

    @model_validator(mode="after")
    def require_content(self) -> "UpdateMessageBody":
        if self.attachment_ids is None:
            return self
        has_text = bool(self.body.strip())
        has_files = bool(self.attachment_ids)
        if not has_text and not has_files:
            raise ValueError("Message must include text or attachments")
        return self


class CreateDmBody(BaseModel):
    userIds: list[str] = Field(min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=80)


class UpdateChannelBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    topic: str | None = Field(default=None, max_length=500)


class UpdateChannelMemberBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    is_following: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("isFollowing", "is_following"),
        serialization_alias="isFollowing",
    )
    starred: bool | None = None
    pinned: bool | None = None
    notification_level: Literal["ALL", "MENTIONS", "NONE"] | None = Field(
        default=None,
        validation_alias=AliasChoices("notificationLevel", "notification_level"),
        serialization_alias="notificationLevel",
    )


class UpdateDmParticipantBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    starred: bool | None = None
    hidden: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("hidden", "isHidden", "is_hidden"),
    )


class UpdateDmBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class AddDmParticipantsBody(BaseModel):
    userIds: list[str] = Field(min_length=1, max_length=20)


class PinMessageBody(BaseModel):
    pinned: bool


class ToggleReactionBody(BaseModel):
    emoji: str = Field(min_length=1, max_length=32)
