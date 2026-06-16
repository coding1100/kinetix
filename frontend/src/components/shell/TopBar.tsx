"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  CalendarIcon,
  CircleHelpIcon,
  SparklesIcon,
  SquareCheckBigIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { useUiStore } from "@/stores/ui-store";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ChatShortcutsMenu } from "@/components/shell/topbar/ChatShortcutsMenu";
import { NotificationsMenu } from "@/components/shell/topbar/NotificationsMenu";
import { TopBarSheets } from "@/components/shell/topbar/TopBarSheets";
import { useTopBarStore } from "@/stores/topbar-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { WorkspaceSwitcherPopup } from "@/components/shell/WorkspaceSwitcherPopup";
import {
  selectActiveWorkspace,
  useAuthStore,
  workspaceInitials,
} from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export function TopBar() {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const openSheet = useTopBarStore((s) => s.openSheet);
  const openModal = useUiStore((s) => s.openModal);
  const activeWorkspace = useAuthStore(selectActiveWorkspace);
  const workspaceLabel = activeWorkspace?.name ?? "Workspace";
  const workspaceBadge = activeWorkspace
    ? workspaceInitials(activeWorkspace.name)
    : "WS";

  return (
    <>
    <div className="grid h-11 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border bg-card px-3">
      <div className="flex items-center gap-1.5">
        <DropdownMenu open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 rounded-md bg-muted px-2 font-semibold text-foreground dark:bg-muted/50"
              >
                <span className="grid size-5 place-items-center rounded bg-gradient-to-br from-violet-600 to-primary text-[9px] font-bold text-white">
                  {workspaceBadge}
                </span>
                <span className="max-w-[140px] truncate">{workspaceLabel}</span>
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform duration-200",
                    workspaceMenuOpen && "rotate-180"
                  )}
                />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-auto p-0">
            <WorkspaceSwitcherPopup />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex justify-center">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Create task"
                onClick={() => openModal("create-task")}
              >
                <SquareCheckBigIcon className="size-4" strokeWidth={2} />
              </Button>
            }
          />
          <TooltipContent side="bottom">Create task</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Calendar"
                onClick={() => openSheet("calendar")}
              >
                <CalendarIcon className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom">Calendar</TooltipContent>
        </Tooltip>
        <ChatShortcutsMenu />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Help"
                onClick={() => openSheet("help")}
              >
                <CircleHelpIcon className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom">Help</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="AI"
                onClick={() => openSheet("ai")}
              >
                <SparklesIcon className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom">AI</TooltipContent>
        </Tooltip>
        
        <NotificationsMenu />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ProfileMenu />
      </div>
    </div>
    <TopBarSheets />
    </>
  );
}
