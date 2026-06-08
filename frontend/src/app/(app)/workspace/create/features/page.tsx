"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ZapIcon,
  ClapperboardIcon,
  TimerIcon,
  ChartGanttIcon,
  TrophyIcon,
  FileCheckIcon,
  LayoutDashboardIcon,
  PresentationIcon,
  FileTextIcon,
  CalendarDaysIcon,
  GaugeIcon,
  CheckCircle2Icon,
  ContactRoundIcon,
  Columns3Icon,
  Clock3Icon,
  CalendarIcon,
  SparklesIcon,
  MessageSquareIcon,
} from "lucide-react";
import { WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";

const FEATURES: { label: string; icon: LucideIcon }[] = [
  { label: "Automations", icon: ZapIcon },
  { label: "Clips", icon: ClapperboardIcon },
  { label: "Sprints", icon: TimerIcon },
  { label: "Gantt Charts", icon: ChartGanttIcon },
  { label: "Goals & OKRs", icon: TrophyIcon },
  { label: "Forms", icon: FileCheckIcon },
  { label: "Dashboards", icon: LayoutDashboardIcon },
  { label: "Whiteboards", icon: PresentationIcon },
  { label: "Docs & Wikis", icon: FileTextIcon },
  { label: "Scheduling", icon: CalendarDaysIcon },
  { label: "Workload", icon: GaugeIcon },
  { label: "Tasks & Projects", icon: CheckCircle2Icon },
  { label: "CRM", icon: ContactRoundIcon },
  { label: "Boards & Kanban", icon: Columns3Icon },
  { label: "Time Tracking", icon: Clock3Icon },
  { label: "Calendar", icon: CalendarIcon },
  { label: "AI", icon: SparklesIcon },
  { label: "Chat", icon: MessageSquareIcon },
];

export default function WorkspaceFeaturesPage() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <WorkspaceSetupShell
      title="Which features are you interested in trying?"
      step={4}
      totalSteps={6}
      backHref="/workspace/create/invite"
      nextHref="/workspace/create/tools"
      nextDisabled={false}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map(({ label, icon: Icon }) => {
          const active = selected.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(label)
                    ? prev.filter((x) => x !== label)
                    : [...prev, label]
                )
              }
              className={`inline-flex items-center justify-between rounded-full border px-5 py-3 text-sm font-medium transition ${
                active
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <span>{label}</span>
              <Icon className={active ? "size-5 text-background/80" : "size-5 text-muted-foreground"} />
            </button>
          );
        })}
      </div>
    </WorkspaceSetupShell>
  );
}
