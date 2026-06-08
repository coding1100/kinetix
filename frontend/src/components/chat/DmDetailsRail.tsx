"use client";

import { SearchIcon, ReplyIcon, SettingsIcon } from "lucide-react";
import { useChatStore, type DmDetailsView } from "@/stores/chat-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RAIL_ACTIONS: {
  view: DmDetailsView;
  label: string;
  icon: typeof SearchIcon;
}[] = [
  { view: "search", label: "Search messages", icon: SearchIcon },
  { view: "replies", label: "Replies", icon: ReplyIcon },
  { view: "settings", label: "Settings", icon: SettingsIcon },
];

function RailIconButton({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: typeof SearchIcon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-8 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              active &&
                "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            )}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
          >
            <Icon className="size-4" strokeWidth={1.5} />
          </Button>
        }
      />
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function DmDetailsRail() {
  const { dmDetailsView, toggleDmDetailsView } = useChatStore();

  return (
    <div
      className="flex w-14 shrink-0 items-start justify-center px-3 py-3"
      aria-label="Direct message details"
    >
      <nav className="flex w-9 flex-col items-center gap-1.5 rounded-md border border-border px-1 py-1 shadow-none">
        {RAIL_ACTIONS.map(({ view, label, icon }) => (
          <RailIconButton
            key={view}
            label={label}
            icon={icon}
            active={dmDetailsView === view}
            onClick={() => toggleDmDetailsView(view)}
          />
        ))}
      </nav>
    </div>
  );
}
