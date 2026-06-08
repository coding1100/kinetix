from pydantic import BaseModel, EmailStr, Field


class SignupBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=120, alias="fullName")
    workspace_name: str | None = Field(default=None, max_length=80, alias="workspaceName")

    model_config = {"populate_by_name": True}


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str = Field(min_length=1)
    password: str = Field(min_length=8)


class OAuthExchangeBody(BaseModel):
    code: str = Field(min_length=1)


class RefreshBody(BaseModel):
    refresh_token: str | None = Field(default=None, alias="refreshToken")

    model_config = {"populate_by_name": True}


class AuthUserOut(BaseModel):
    id: str
    email: str
    full_name: str = Field(serialization_alias="fullName")
    avatar_url: str | None = Field(serialization_alias="avatarUrl")

    model_config = {"populate_by_name": True}


class AuthResponse(BaseModel):
    user: AuthUserOut
    access_token: str = Field(serialization_alias="accessToken")

    model_config = {"populate_by_name": True}


class WorkspaceSummary(BaseModel):
    id: str
    name: str
    slug: str
    role: str


class UpdateProfileBody(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120, alias="fullName")
    avatar_url: str | None = Field(default=None, max_length=500, alias="avatarUrl")

    model_config = {"populate_by_name": True}


class ChangePasswordBody(BaseModel):
    current_password: str = Field(min_length=1, alias="currentPassword")
    new_password: str = Field(min_length=8, alias="newPassword")

    model_config = {"populate_by_name": True}


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str = Field(serialization_alias="fullName")
    avatar_url: str | None = Field(serialization_alias="avatarUrl")
    created_at: str = Field(serialization_alias="createdAt")
    has_password: bool = Field(serialization_alias="hasPassword")
    workspaces: list[WorkspaceSummary]

    model_config = {"populate_by_name": True}
