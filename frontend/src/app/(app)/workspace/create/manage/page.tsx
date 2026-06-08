"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  UserIcon,
  LifeBuoyIcon,
  MegaphoneIcon,
  CogIcon,
  LandmarkIcon,
  CodeIcon,
  RocketIcon,
  UsersIcon,
  ClipboardListIcon,
  PaletteIcon,
  BriefcaseIcon,
  MonitorIcon,
  HandshakeIcon,
  CircleEllipsisIcon,
} from "lucide-react";
import { SelectPill, WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";

const OPTIONS: { label: string; icon: LucideIcon }[] = [
  { label: "Personal Use", icon: UserIcon },
  { label: "Support", icon: LifeBuoyIcon },
  { label: "Marketing", icon: MegaphoneIcon },
  { label: "Operations", icon: CogIcon },
  { label: "Finance & Accounting", icon: LandmarkIcon },
  { label: "Software Development", icon: CodeIcon },
  { label: "Startup", icon: RocketIcon },
  { label: "HR & Recruiting", icon: UsersIcon },
  { label: "PMO", icon: ClipboardListIcon },
  { label: "Creative & Design", icon: PaletteIcon },
  { label: "Professional Services", icon: BriefcaseIcon },
  { label: "IT", icon: MonitorIcon },
  { label: "Sales & CRM", icon: HandshakeIcon },
  { label: "Other", icon: CircleEllipsisIcon },
];

export default function WorkspaceManagePage() {
  const [selected, setSelected] = useState<string | null>("Startup");

  return (
    <WorkspaceSetupShell
      title="What would you like to manage?"
      step={2}
      totalSteps={6}
      backHref="/workspace/create/use-case"
      nextHref="/workspace/create/invite"
      nextDisabled={!selected}
    >
      <div className="flex flex-wrap gap-3">
        {OPTIONS.map((option) => (
          <SelectPill
            key={option.label}
            label={option.label}
            icon={option.icon}
            selected={selected === option.label}
            onClickAction={() => setSelected(option.label)}
          />
        ))}
      </div>
    </WorkspaceSetupShell>
  );
}
