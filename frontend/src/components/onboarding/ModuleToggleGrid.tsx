"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const MODULES = [
  { id: "chat", label: "Chat", description: "Channels, DMs, threads" },
  { id: "docs", label: "Docs", description: "Rich notes and collaboration" },
  { id: "dashboard", label: "Dashboards", description: "Project insights and KPIs" },
  { id: "goals", label: "Goals", description: "Track outcomes and milestones" },
  { id: "forms", label: "Forms", description: "Collect requests and intake" },
  { id: "timesheet", label: "Timesheet", description: "Time tracking and reports" },
];

export function ModuleToggleGrid() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    chat: true,
    docs: true,
    dashboard: false,
    goals: false,
    forms: false,
    timesheet: false,
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {MODULES.map((module) => {
        const active = !!enabled[module.id];
        return (
          <label
            key={module.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors",
              active ? "bg-primary/5" : "bg-card"
            )}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={(e) =>
                setEnabled((prev) => ({ ...prev, [module.id]: e.target.checked }))
              }
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">{module.label}</span>
              <span className="block text-xs text-muted-foreground">{module.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
