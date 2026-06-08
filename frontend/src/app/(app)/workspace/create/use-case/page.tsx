"use client";

import { useState } from "react";
import { BriefcaseBusinessIcon, UserIcon, GraduationCapIcon } from "lucide-react";
import { SelectPill, WorkspaceSetupShell } from "@/components/workspace/WorkspaceSetupShell";

const OPTIONS = [
  { label: "Work", icon: BriefcaseBusinessIcon },
  { label: "Personal", icon: UserIcon },
  { label: "School", icon: GraduationCapIcon },
];

export default function WorkspaceUseCasePage() {
  const [selected, setSelected] = useState<string | null>("Work");

  return (
    <WorkspaceSetupShell
      title="What will you use this Workspace for?"
      rightHeaderText="Welcome, Husnain!"
      step={1}
      totalSteps={6}
      backHref="/home/inbox"
      nextHref="/workspace/create/manage"
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
