"use client";

import { useState } from "react";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { useUiStore } from "@/stores/ui-store";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { NotificationsMenu } from "@/components/shell/topbar/NotificationsMenu";
import { TopBarSheets } from "@/components/shell/topbar/TopBarSheets";
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
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export function TopBar() {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
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
            <WorkspaceSwitcherPopup onClose={() => setWorkspaceMenuOpen(false)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex justify-center">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 border-neutral-200 bg-white px-2 text-xs text-black hover:bg-neutral-100 hover:text-black dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:hover:text-black"
          onClick={() => openModal("create-task")}
        >
          <PlusIcon className="size-3.5" strokeWidth={2} />
          Create task
        </Button>
        {FEATURE_FLAGS.topBarNotifications ? <NotificationsMenu /> : null}
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ProfileMenu />
      </div>
    </div>
    <TopBarSheets />
    </>
  );
}
