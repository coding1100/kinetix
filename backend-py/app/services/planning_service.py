from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.planning import (
    EntityTemplate,
    Portfolio,
    PortfolioList,
    TaskAutomationRule,
    Whiteboard,
)
from app.db.models.home import Task, TaskList, Space, TaskDependency, ListStatus
from app.db.models.user import User
from app.schemas.planning import (
    CreateAutomationRuleBody,
    CreatePortfolioBody,
    CreateTemplateBody,
    CreateWhiteboardBody,
    InstantiateTemplateBody,
    UpdateAutomationRuleBody,
    UpdatePortfolioBody,
    UpdateWhiteboardBody,
)


# --- TEMPLATES ---
async def list_templates(session: AsyncSession, workspace_id: str, scope: str | None = None) -> list[dict[str, Any]]:
    query = select(EntityTemplate).where(EntityTemplate.workspace_id == workspace_id)
    if scope:
        query = query.where(EntityTemplate.scope == scope)
    result = await session.execute(query.order_by(EntityTemplate.created_at.desc()))
    templates = result.scalars().all()
    return [
        {
            "id": t.id,
            "workspaceId": t.workspace_id,
            "name": t.name,
            "description": t.description,
            "scope": t.scope.value if hasattr(t.scope, "value") else str(t.scope),
            "category": t.category,
            "templateData": t.template_data,
            "createdById": t.created_by_id,
            "isPublic": t.is_public,
            "createdAt": t.created_at.isoformat() if t.created_at else None,
        }
        for t in templates
    ]


async def create_template(session: AsyncSession, workspace_id: str, user_id: str, body: CreateTemplateBody) -> dict[str, Any]:
    template = EntityTemplate(
        workspace_id=workspace_id,
        name=body.name,
        description=body.description,
        scope=body.scope,
        category=body.category,
        template_data=body.templateData,
        created_by_id=user_id,
        is_public=body.isPublic,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return {
        "id": template.id,
        "name": template.name,
        "scope": template.scope.value if hasattr(template.scope, "value") else str(template.scope),
        "category": template.category,
    }


async def instantiate_template(
    session: AsyncSession, workspace_id: str, user_id: str, template_id: str, body: InstantiateTemplateBody
) -> dict[str, Any]:
    res = await session.execute(select(EntityTemplate).where(EntityTemplate.id == template_id, EntityTemplate.workspace_id == workspace_id))
    template = res.scalar_one_or_none()
    if not template:
        raise ValueError("Template not found")

    scope_val = template.scope.value if hasattr(template.scope, "value") else str(template.scope)
    data = template.template_data or {}

    if scope_val == "TASK":
        if not body.listId:
            raise ValueError("listId required to instantiate task template")
        task_name = body.name or data.get("name") or template.name
        new_task = Task(
            list_id=body.listId,
            name=task_name,
            description=data.get("description"),
            priority=data.get("priority"),
            time_estimate_minutes=data.get("timeEstimateMinutes"),
            tags=data.get("tags") or [],
            is_milestone=data.get("isMilestone", False),
        )
        session.add(new_task)
        await session.commit()
        await session.refresh(new_task)
        return {"id": new_task.id, "type": "TASK", "name": new_task.name, "listId": new_task.list_id}

    elif scope_val == "LIST":
        if not body.spaceId:
            raise ValueError("spaceId required to instantiate list template")
        list_name = body.name or data.get("name") or template.name
        new_list = TaskList(
            space_id=body.spaceId,
            name=list_name,
            created_by_id=user_id,
        )
        session.add(new_list)
        await session.commit()
        await session.refresh(new_list)

        # Create sub-tasks if defined in templateData
        subtasks_data = data.get("tasks") or []
        for td in subtasks_data:
            st = Task(
                list_id=new_list.id,
                name=td.get("name", "Untitled Task"),
                description=td.get("description"),
                priority=td.get("priority"),
            )
            session.add(st)
        await session.commit()
        return {"id": new_list.id, "type": "LIST", "name": new_list.name, "spaceId": new_list.space_id}

    else:
        raise ValueError(f"Instantiation for scope {scope_val} not supported")


# --- PORTFOLIOS ---
async def list_portfolios(session: AsyncSession, workspace_id: str) -> list[dict[str, Any]]:
    res = await session.execute(
        select(Portfolio).where(Portfolio.workspace_id == workspace_id).order_by(Portfolio.created_at.desc())
    )
    portfolios = res.scalars().all()
    results = []
    for p in portfolios:
        list_links = await session.execute(select(PortfolioList.list_id).where(PortfolioList.portfolio_id == p.id))
        linked_ids = list_links.scalars().all()
        results.append({
            "id": p.id,
            "workspaceId": p.workspace_id,
            "name": p.name,
            "description": p.description,
            "color": p.color,
            "listIds": linked_ids,
            "createdById": p.created_by_id,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
        })
    return results


async def create_portfolio(session: AsyncSession, workspace_id: str, user_id: str, body: CreatePortfolioBody) -> dict[str, Any]:
    portfolio = Portfolio(
        workspace_id=workspace_id,
        name=body.name,
        description=body.description,
        color=body.color,
        created_by_id=user_id,
    )
    session.add(portfolio)
    await session.flush()

    for lid in body.listIds:
        session.add(PortfolioList(portfolio_id=portfolio.id, list_id=lid))

    await session.commit()
    await session.refresh(portfolio)
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "color": portfolio.color,
        "listIds": body.listIds,
    }


async def get_portfolio_summary(session: AsyncSession, workspace_id: str, portfolio_id: str) -> dict[str, Any]:
    p_res = await session.execute(select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.workspace_id == workspace_id))
    portfolio = p_res.scalar_one_or_none()
    if not portfolio:
        raise ValueError("Portfolio not found")

    list_links = await session.execute(select(PortfolioList.list_id).where(PortfolioList.portfolio_id == portfolio.id))
    list_ids = list_links.scalars().all()

    if not list_ids:
        return {
            "portfolioId": portfolio.id,
            "name": portfolio.name,
            "totalLists": 0,
            "totalTasks": 0,
            "completedTasks": 0,
            "overdueTasks": 0,
            "completionRate": 0.0,
            "totalEstimatedMinutes": 0,
            "statusHealth": "ON_TRACK",
        }

    tasks_res = await session.execute(select(Task).where(Task.list_id.in_(list_ids)))
    tasks = tasks_res.scalars().all()

    now = datetime.now(timezone.utc)
    total_tasks = len(tasks)
    completed_tasks = 0
    overdue_tasks = 0
    total_est = 0

    for t in tasks:
        st_val = t.status.value if hasattr(t.status, "value") else str(t.status)
        if st_val == "DONE":
            completed_tasks += 1
        elif t.due_date and t.due_date.replace(tzinfo=timezone.utc) < now:
            overdue_tasks += 1
        if t.time_estimate_minutes:
            total_est += t.time_estimate_minutes

    rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0
    status_health = "BEHIND" if overdue_tasks > 3 else ("AT_RISK" if overdue_tasks > 0 else "ON_TRACK")

    return {
        "portfolioId": portfolio.id,
        "name": portfolio.name,
        "color": portfolio.color,
        "totalLists": len(list_ids),
        "totalTasks": total_tasks,
        "completedTasks": completed_tasks,
        "overdueTasks": overdue_tasks,
        "completionRate": rate,
        "totalEstimatedMinutes": total_est,
        "statusHealth": status_health,
    }


# --- GANTT CHART & MILESTONES ---
async def get_gantt_data(session: AsyncSession, workspace_id: str, space_id: str | None = None, list_id: str | None = None) -> dict[str, Any]:
    query = select(Task).join(TaskList, Task.list_id == TaskList.id).join(Space, TaskList.space_id == Space.id).where(Space.workspace_id == workspace_id)
    if space_id:
        query = query.where(Space.id == space_id)
    if list_id:
        query = query.where(Task.list_id == list_id)

    res = await session.execute(query)
    tasks = res.scalars().all()
    task_ids = [t.id for t in tasks]

    dependencies = []
    if task_ids:
        dep_res = await session.execute(
            select(TaskDependency).where(TaskDependency.task_id.in_(task_ids) | TaskDependency.related_task_id.in_(task_ids))
        )
        deps = dep_res.scalars().all()
        for d in deps:
            dependencies.append({
                "id": d.id,
                "taskId": d.task_id,
                "relatedTaskId": d.related_task_id,
                "dependencyType": d.dependency_type,
            })

    task_nodes = [
        {
            "id": t.id,
            "listId": t.list_id,
            "name": t.name,
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
            "priority": t.priority.value if t.priority and hasattr(t.priority, "value") else (str(t.priority) if t.priority else None),
            "startDateIso": t.start_date.isoformat() if t.start_date else None,
            "dueDateIso": t.due_date.isoformat() if t.due_date else None,
            "isMilestone": getattr(t, "is_milestone", False),
            "assigneeIds": t.assignee_ids or [],
        }
        for t in tasks
    ]

    return {
        "tasks": task_nodes,
        "dependencies": dependencies,
    }


# --- WORKLOAD MANAGEMENT ---
async def get_workload_summary(session: AsyncSession, workspace_id: str) -> list[dict[str, Any]]:
    # Gather workspace users & tasks assigned to them
    members_res = await session.execute(select(User))
    users = members_res.scalars().all()

    tasks_res = await session.execute(
        select(Task).join(TaskList, Task.list_id == TaskList.id).join(Space, TaskList.space_id == Space.id).where(Space.workspace_id == workspace_id)
    )
    tasks = tasks_res.scalars().all()

    user_map = {}
    for u in users:
        user_map[u.id] = {
            "userId": u.id,
            "name": getattr(u, "full_name", None) or u.email,
            "email": u.email,
            "assignedTasksCount": 0,
            "totalEstimatedHours": 0.0,
            "capacityHours": 40.0,
            "status": "OPTIMAL",
        }


    for t in tasks:
        est_hrs = (t.time_estimate_minutes or 60) / 60.0
        for aid in t.assignee_ids or []:
            if aid in user_map:
                user_map[aid]["assignedTasksCount"] += 1
                user_map[aid]["totalEstimatedHours"] += est_hrs

    results = list(user_map.values())
    for item in results:
        hrs = item["totalEstimatedHours"]
        if hrs > 40.0:
            item["status"] = "OVER_CAPACITY"
        elif hrs < 15.0:
            item["status"] = "UNDER_UTILIZED"

    return results


# --- AUTOMATIONS ---
async def list_automations(session: AsyncSession, workspace_id: str) -> list[dict[str, Any]]:
    res = await session.execute(
        select(TaskAutomationRule).where(TaskAutomationRule.workspace_id == workspace_id).order_by(TaskAutomationRule.created_at.desc())
    )
    rules = res.scalars().all()
    return [
        {
            "id": r.id,
            "workspaceId": r.workspace_id,
            "spaceId": r.space_id,
            "listId": r.list_id,
            "name": r.name,
            "triggerType": r.trigger_type.value if hasattr(r.trigger_type, "value") else str(r.trigger_type),
            "triggerConfig": r.trigger_config,
            "actionType": r.action_type.value if hasattr(r.action_type, "value") else str(r.action_type),
            "actionConfig": r.action_config,
            "isActive": r.is_active,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rules
    ]


async def create_automation(session: AsyncSession, workspace_id: str, body: CreateAutomationRuleBody) -> dict[str, Any]:
    rule = TaskAutomationRule(
        workspace_id=workspace_id,
        space_id=body.spaceId,
        list_id=body.listId,
        name=body.name,
        trigger_type=body.triggerType,
        trigger_config=body.triggerConfig,
        action_type=body.actionType,
        action_config=body.actionConfig,
        is_active=body.isActive,
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return {
        "id": rule.id,
        "name": rule.name,
        "triggerType": rule.trigger_type.value if hasattr(rule.trigger_type, "value") else str(rule.trigger_type),
        "actionType": rule.action_type.value if hasattr(rule.action_type, "value") else str(rule.action_type),
        "isActive": rule.is_active,
    }


# --- WHITEBOARDS ---
async def list_whiteboards(session: AsyncSession, workspace_id: str) -> list[dict[str, Any]]:
    res = await session.execute(
        select(Whiteboard).where(Whiteboard.workspace_id == workspace_id).order_by(Whiteboard.updated_at.desc())
    )
    boards = res.scalars().all()
    return [
        {
            "id": w.id,
            "workspaceId": w.workspace_id,
            "spaceId": w.space_id,
            "name": w.name,
            "canvasData": w.canvas_data,
            "createdById": w.created_by_id,
            "createdAt": w.created_at.isoformat() if w.created_at else None,
            "updatedAt": w.updated_at.isoformat() if w.updated_at else None,
        }
        for w in boards
    ]


async def create_whiteboard(session: AsyncSession, workspace_id: str, user_id: str, body: CreateWhiteboardBody) -> dict[str, Any]:
    board = Whiteboard(
        workspace_id=workspace_id,
        space_id=body.spaceId,
        name=body.name,
        canvas_data=body.canvasData or {"nodes": [], "edges": []},
        created_by_id=user_id,
    )
    session.add(board)
    await session.commit()
    await session.refresh(board)
    return {
        "id": board.id,
        "name": board.name,
        "canvasData": board.canvas_data,
    }


async def update_whiteboard(session: AsyncSession, workspace_id: str, whiteboard_id: str, body: UpdateWhiteboardBody) -> dict[str, Any]:
    res = await session.execute(select(Whiteboard).where(Whiteboard.id == whiteboard_id, Whiteboard.workspace_id == workspace_id))
    board = res.scalar_one_or_none()
    if not board:
        raise ValueError("Whiteboard not found")

    if body.name is not None:
        board.name = body.name
    if body.canvasData is not None:
        board.canvas_data = body.canvasData

    await session.commit()
    await session.refresh(board)
    return {
        "id": board.id,
        "name": board.name,
        "canvasData": board.canvas_data,
    }
