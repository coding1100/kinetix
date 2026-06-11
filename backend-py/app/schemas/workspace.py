from pydantic import BaseModel, EmailStr, Field

from app.db.models.enums import WorkspaceRole


class CreateWorkspaceBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class UpdateWorkspaceBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)


class CreateInviteBody(BaseModel):
    email: EmailStr
    role: WorkspaceRole = WorkspaceRole.MEMBER


class UpdateWorkspaceMemberBody(BaseModel):
    role: WorkspaceRole


class DeleteWorkspaceBody(BaseModel):
    confirm_name: str = Field(min_length=1, max_length=80, alias="confirmName")

    model_config = {"populate_by_name": True}


class TransferWorkspaceOwnershipBody(BaseModel):
    new_owner_user_id: str = Field(min_length=1, alias="newOwnerUserId")

    model_config = {"populate_by_name": True}


class AcceptInviteSignupBody(BaseModel):
    full_name: str = Field(min_length=1, max_length=120, alias="fullName")
    password: str = Field(min_length=8)

    model_config = {"populate_by_name": True}
