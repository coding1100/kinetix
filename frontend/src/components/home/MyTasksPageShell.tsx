"use client";

import { Suspense, type ReactNode } from "react";
import { SquareCheckBigIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MyTasksToolbar } from "@/components/home/MyTasksToolbar";
import { MyTasksTaskDrawer } from "@/components/home/useMyTasksTaskDrawer";
import { useUiStore } from "@/stores/ui-store";

export function MyTasksPageShell({
  title,
  subtitle,
  headerRight,
  basePath,
  children,
  showToolbar = true,
  showCreateTask = false,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  onTasksRefresh,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  basePath: string;
  children: ReactNode;
  showToolbar?: boolean;
  showCreateTask?: boolean;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  statusOptions?: { id: string; name: string }[];
  onTasksRefresh?: () => void;
}) {
  const openModal = useUiStore((s) => s.openModal);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerRight}
              {showCreateTask ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-9 w-9 rounded-full"
                        aria-label="Create task"
                        onClick={() => openModal("create-task")}
                      >
                        <SquareCheckBigIcon className="size-4" strokeWidth={2} />
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom">Create task</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>

        {showToolbar ? (
          <MyTasksToolbar
            statusFilter={statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            statusOptions={statusOptions}
            showStatusFilter={
              statusFilter !== undefined && onStatusFilterChange !== undefined
            }
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>

      <MyTasksTaskDrawer
        basePath={basePath}
        onSaved={onTasksRefresh}
        onDeleted={onTasksRefresh}
      />
    </>
  );
}

export function MyTasksPageShellSuspense(props: Parameters<typeof MyTasksPageShell>[0]) {
  return (
    <Suspense fallback={null}>
      <MyTasksPageShell {...props} />
    </Suspense>
  );
}
