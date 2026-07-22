import type { AuditLogEntry } from "@/lib/api/admin";

const ACTION_LABELS: Record<string, string> = {
  "workspace.suspend": "Workspace suspended",
  "workspace.reactivate": "Workspace reactivated",
  "workspace.delete": "Workspace archived",
  "workspace.restore": "Workspace restored",
  "workspace.transfer_ownership": "Ownership transferred",
  "workspace.member.role_change": "Member role changed",
  "workspace.member.suspend": "Member disabled in workspace",
  "workspace.member.reactivate": "Member re-enabled in workspace",
  "user.disable": "User disabled",
  "user.enable": "User enabled",
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function describeAuditEntry(entry: AuditLogEntry): {
  title: string;
  detail: string | null;
} {
  const m = entry.metadata ?? {};
  const title = ACTION_LABELS[entry.action] ?? entry.action;

  switch (entry.action) {
    case "workspace.suspend":
    case "workspace.reactivate":
    case "workspace.delete":
    case "workspace.restore": {
      const name = str(m.name);
      return { title, detail: name ? `"${name}"` : null };
    }
    case "workspace.transfer_ownership": {
      const to = str(m.newOwnerFullName) ?? str(m.newOwnerEmail) ?? str(m.newOwnerUserId);
      const from =
        str(m.previousOwnerFullName) ?? str(m.previousOwnerEmail) ?? str(m.previousOwnerUserId);
      const workspaceName = str(m.workspaceName);
      const who = from ? `${from} → ${to}` : `New owner: ${to}`;
      return { title, detail: workspaceName ? `${who} (${workspaceName})` : who };
    }
    case "workspace.member.role_change": {
      const who = str(m.userFullName) ?? str(m.userEmail) ?? str(m.userId);
      const oldRole = str(m.oldRole);
      const newRole = str(m.newRole);
      const workspaceName = str(m.workspaceName);
      const change = oldRole && newRole ? `${oldRole} → ${newRole}` : null;
      const detail = [who, change].filter(Boolean).join(": ") || null;
      return { title, detail: workspaceName ? `${detail} (${workspaceName})` : detail };
    }
    case "workspace.member.suspend":
    case "workspace.member.reactivate": {
      const who = str(m.userFullName) ?? str(m.userEmail) ?? str(m.userId);
      const workspaceName = str(m.workspaceName);
      return { title, detail: workspaceName && who ? `${who} (${workspaceName})` : who };
    }
    case "user.disable":
    case "user.enable": {
      const who = str(m.fullName) ?? str(m.email);
      return { title, detail: who };
    }
    default:
      return { title, detail: null };
  }
}

export function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
