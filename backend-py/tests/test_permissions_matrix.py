"""Pure unit tests for the role/permission matrices (no DB, no server).

Covers workspace_permissions.py and space_permissions.py decision tables so
regressions in the ClickUp-aligned hierarchy fail fast without needing the
API stack.
"""

from __future__ import annotations

import pytest

from app.db.models.enums import PermissionLevel, WorkspaceRole
from app.services.space_permissions import level_at_least
from app.services.workspace_permissions import (
    ROLE_RANK,
    can_assign_role,
    can_delete_workspace,
    can_edit_member,
    can_manage_people,
    can_manage_teams,
    can_transfer_ownership,
    is_owner,
    is_privileged,
    is_super_admin,
    is_workspace_admin,
)

ALL_ROLES = list(WorkspaceRole)

CONTENT_ROLES = {
    WorkspaceRole.MEMBER,
    WorkspaceRole.GUEST,
    WorkspaceRole.LIMITED_MEMBER,
}


def test_role_rank_orders_full_hierarchy():
    assert (
        ROLE_RANK[WorkspaceRole.OWNER]
        > ROLE_RANK[WorkspaceRole.SUPER_ADMIN]
        > ROLE_RANK[WorkspaceRole.ADMIN]
        > ROLE_RANK[WorkspaceRole.MEMBER]
        > ROLE_RANK[WorkspaceRole.LIMITED_MEMBER]
        > ROLE_RANK[WorkspaceRole.GUEST]
    )
    assert set(ROLE_RANK) == set(ALL_ROLES)


@pytest.mark.parametrize(
    ("actor", "assignable"),
    [
        (WorkspaceRole.OWNER, set(ALL_ROLES)),
        (
            WorkspaceRole.SUPER_ADMIN,
            set(ALL_ROLES) - {WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN},
        ),
        (WorkspaceRole.ADMIN, CONTENT_ROLES),
        (WorkspaceRole.MEMBER, CONTENT_ROLES),
        (WorkspaceRole.LIMITED_MEMBER, set()),
        (WorkspaceRole.GUEST, set()),
    ],
)
def test_can_assign_role_matrix(actor: WorkspaceRole, assignable: set[WorkspaceRole]):
    for new_role in ALL_ROLES:
        assert can_assign_role(actor, new_role) is (new_role in assignable), (
            f"{actor.value} assigning {new_role.value}"
        )


@pytest.mark.parametrize(
    ("actor", "editable"),
    [
        (WorkspaceRole.OWNER, set(ALL_ROLES)),
        (
            WorkspaceRole.SUPER_ADMIN,
            set(ALL_ROLES) - {WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN},
        ),
        (
            WorkspaceRole.ADMIN,
            set(ALL_ROLES) - {WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN},
        ),
        (WorkspaceRole.MEMBER, set()),
        (WorkspaceRole.LIMITED_MEMBER, set()),
        (WorkspaceRole.GUEST, set()),
    ],
)
def test_can_edit_member_matrix(actor: WorkspaceRole, editable: set[WorkspaceRole]):
    for target in ALL_ROLES:
        assert can_edit_member(actor, target) is (target in editable), (
            f"{actor.value} editing {target.value}"
        )


def test_owner_only_gates():
    for role in ALL_ROLES:
        expected = role == WorkspaceRole.OWNER
        assert can_delete_workspace(role) is expected
        assert can_transfer_ownership(role) is expected
        assert is_owner(role) is expected
    assert can_delete_workspace(None) is False
    assert can_transfer_ownership(None) is False


def test_privileged_and_admin_sets():
    privileged = {WorkspaceRole.OWNER, WorkspaceRole.SUPER_ADMIN}
    managers = privileged | {WorkspaceRole.ADMIN}
    for role in ALL_ROLES:
        assert is_privileged(role) is (role in privileged)
        assert is_workspace_admin(role) is (role in managers)
        assert can_manage_people(role) is (role in managers)
        assert can_manage_teams(role) is (role in managers)
    assert is_privileged(None) is False
    assert is_workspace_admin(None) is False
    assert is_super_admin(WorkspaceRole.SUPER_ADMIN) is True
    assert is_super_admin(WorkspaceRole.OWNER) is False


def test_level_at_least():
    assert level_at_least(PermissionLevel.EDIT, PermissionLevel.VIEW)
    assert level_at_least(PermissionLevel.EDIT, PermissionLevel.COMMENT)
    assert level_at_least(PermissionLevel.EDIT, PermissionLevel.EDIT)
    assert level_at_least(PermissionLevel.COMMENT, PermissionLevel.VIEW)
    assert not level_at_least(PermissionLevel.COMMENT, PermissionLevel.EDIT)
    assert not level_at_least(PermissionLevel.VIEW, PermissionLevel.COMMENT)
    assert not level_at_least(None, PermissionLevel.VIEW)

