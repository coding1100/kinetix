"use client";

import type { AuditLogEntry } from "@/lib/api/admin";
import { describeAuditEntry, formatAuditTimestamp } from "@/lib/audit";

export function AuditList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)]">No activity yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => {
        const { title, detail } = describeAuditEntry(entry);
        return (
          <li
            key={entry.id}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">{title}</p>
                {detail && (
                  <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{detail}</p>
                )}
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  by {entry.actor.fullName} ({entry.actor.email})
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
                {formatAuditTimestamp(entry.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
