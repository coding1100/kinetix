"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileSpreadsheetIcon,
  CircleIcon,
  VideoIcon,
  NotepadTextIcon,
  PaletteIcon,
  BookOpenIcon,
  UsersIcon,
  BugIcon,
  CalendarRangeIcon,
  CheckSquareIcon,
  MessageCircleIcon,
  CloudIcon,
  Code2Icon,
  FolderSyncIcon,
  BoxIcon,
  ListTodoIcon,
  KanbanSquareIcon,
  LayersIcon,
} from "lucide-react";
import { WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";

const TOOLS: { label: string; icon: LucideIcon }[] = [
  { label: "Excel & CSV", icon: FileSpreadsheetIcon },
  { label: "Asana", icon: CircleIcon },
  { label: "Zoom", icon: VideoIcon },
  { label: "Notion", icon: NotepadTextIcon },
  { label: "Figma", icon: PaletteIcon },
  { label: "Confluence", icon: BookOpenIcon },
  { label: "MS Teams", icon: UsersIcon },
  { label: "Jira", icon: BugIcon },
  { label: "Monday", icon: CalendarRangeIcon },
  { label: "Wrike", icon: CheckSquareIcon },
  { label: "Slack", icon: MessageCircleIcon },
  { label: "Salesforce", icon: CloudIcon },
  { label: "GitHub", icon: Code2Icon },
  { label: "Google Drive", icon: FolderSyncIcon },
  { label: "Dropbox", icon: BoxIcon },
  { label: "Todoist", icon: ListTodoIcon },
  { label: "Trello", icon: KanbanSquareIcon },
  { label: "Basecamp", icon: LayersIcon },
];

export default function WorkspaceToolsPage() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <WorkspaceSetupShell
      title="Do you use any of these tools?"
      step={5}
      totalSteps={6}
      backHref="/workspace/create/features"
      nextHref="/workspace/create/name"
      nextDisabled={false}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map(({ label, icon: Icon }) => {
          const active = selected.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
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
