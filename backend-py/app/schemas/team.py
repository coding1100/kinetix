from pydantic import BaseModel, Field

from app.db.models.enums import TeamRole


class CreateTeamBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=4)
    description: str | None = Field(default=None, max_length=500)
    member_ids: list[str] = Field(default_factory=list, alias="memberIds")

    model_config = {"populate_by_name": True}


class UpdateTeamBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=4)
    description: str | None = Field(default=None, max_length=500)

    model_config = {"populate_by_name": True}


class AddTeamMemberBody(BaseModel):
    user_id: str = Field(min_length=1, alias="userId")
    role: TeamRole = TeamRole.MEMBER

    model_config = {"populate_by_name": True}


class UpdateTeamMemberBody(BaseModel):
    role: TeamRole
