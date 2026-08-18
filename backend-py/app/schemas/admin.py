from pydantic import BaseModel, EmailStr, Field, model_validator

from app.db.models.enums import PlatformRole, WorkspaceRole


class AdminUpdateMemberRoleBody(BaseModel):
    role: WorkspaceRole


class AdminGrantStaffBody(BaseModel):
    email: EmailStr
    role: PlatformRole = PlatformRole.STAFF


class AdminLoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class AdminTransferOwnershipBody(BaseModel):
    new_owner_user_id: str | None = Field(default=None, alias="newOwnerUserId")
    new_owner_email: EmailStr | None = Field(default=None, alias="newOwnerEmail")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _require_target(self) -> "AdminTransferOwnershipBody":
        if not self.new_owner_user_id and not self.new_owner_email:
            raise ValueError("newOwnerUserId or newOwnerEmail is required")
        return self
