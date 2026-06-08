from pydantic import BaseModel, ConfigDict, Field


class CreateSpaceBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=500)


class UpdateSpaceBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=500)


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
    body: str = Field(min_length=1, max_length=5000)
