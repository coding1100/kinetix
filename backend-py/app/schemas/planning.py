from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.db.models.enums import AutomationAction, AutomationTrigger, TemplateScope


class CreateTemplateBody(BaseModel):
    name: str
    description: Optional[str] = None
    scope: TemplateScope = TemplateScope.TASK
    category: str = "General"
    templateData: dict[str, Any] = Field(default_factory=dict)
    isPublic: bool = True


class InstantiateTemplateBody(BaseModel):
    name: Optional[str] = None
    spaceId: Optional[str] = None
    listId: Optional[str] = None


class CreatePortfolioBody(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#4194F6"
    listIds: list[str] = Field(default_factory=list)


class UpdatePortfolioBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    listIds: Optional[list[str]] = None


class CreateAutomationRuleBody(BaseModel):
    name: str
    spaceId: Optional[str] = None
    listId: Optional[str] = None
    triggerType: AutomationTrigger
    triggerConfig: dict[str, Any] = Field(default_factory=dict)
    actionType: AutomationAction
    actionConfig: dict[str, Any] = Field(default_factory=dict)
    isActive: bool = True


class UpdateAutomationRuleBody(BaseModel):
    name: Optional[str] = None
    triggerType: Optional[AutomationTrigger] = None
    triggerConfig: Optional[dict[str, Any]] = None
    actionType: Optional[AutomationAction] = None
    actionConfig: Optional[dict[str, Any]] = None
    isActive: Optional[bool] = None


class CreateWhiteboardBody(BaseModel):
    name: str
    spaceId: Optional[str] = None
    canvasData: dict[str, Any] = Field(default_factory=dict)


class UpdateWhiteboardBody(BaseModel):
    name: Optional[str] = None
    canvasData: Optional[dict[str, Any]] = None
