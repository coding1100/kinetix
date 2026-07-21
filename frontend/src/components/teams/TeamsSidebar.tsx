"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  NetworkIcon,
  PanelLeftCloseIcon,
  PlusIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";
import { fetchMyTeams } from "@/lib/api/teams";
import { useHomeQuery } from "@/hooks/use-home-query";
import { useShellStore } from "@/stores/shell-store";
import { useTeamsStore } from "@/stores/teams-store";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TeamsSidebar({
  onCreateTeam,
}: {
  onCreateTeam?: () => void;
}) {
  const pathname = usePathname();
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useShellStore();
  const refreshKey = useTeamsStore((s) => s.refreshKey);
  const { ready } = useWorkspaceApi();
  const { data: myTeams, loading } = useHomeQuery(
    (token, ws) => fetchMyTeams(token, ws).then((r) => r.data),
    [refreshKey]
  );

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
      active
        ? "bg-accent font-medium text-accent-foreground"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    );

  return (
    <aside
      className={cn(
        "flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-muted/20",
        !secondaryPanelOpen && "hidden lg:flex"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold">Teams</h2>
        <div className="flex items-center gap-1">
          {onCreateTeam ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={onCreateTeam}
                    aria-label="Create team"
                  >
                    <PlusIcon className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>Create team</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/teams?create=1"
                    className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"
                    aria-label="Create team"
                  >
                    <PlusIcon className="size-4" />
                  </Link>
                }
              />
              <TooltipContent>Create team</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setSecondaryPanelOpen(false)}
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftCloseIcon className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Collapse</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <nav className="space-y-0.5" aria-label="Teams navigation">
          <Link
            href="/teams"
            className={navLinkClass(pathname === "/teams")}
          >
            <UsersRoundIcon className="size-4 shrink-0" />
            All Teams
          </Link>
          <Link href="/people" className={navLinkClass(pathname.startsWith("/people"))}>
            <UsersIcon className="size-4 shrink-0" />
            All People
          </Link>
          <button
            type="button"
            disabled
            className={cn(navLinkClass(false), "w-full cursor-not-allowed opacity-50")}
            title="Coming soon"
          >
            <NetworkIcon className="size-4 shrink-0" />
            Org Chart
          </button>
          <button
            type="button"
            disabled
            className={cn(navLinkClass(false), "w-full cursor-not-allowed opacity-50")}
            title="Coming soon"
          >
            <BarChart3Icon className="size-4 shrink-0" />
            Analytics
          </button>
        </nav>

        <Separator className="my-3" />

        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          My Teams
        </p>
        {!ready || loading ? (
          <p className="px-2 text-xs text-muted-foreground">Loading…</p>
        ) : myTeams && myTeams.length > 0 ? (
          <div className="space-y-0.5">
            {myTeams.map((team) => {
              const active = pathname === `/teams/${team.id}`;
              return (
                <Tooltip key={team.id}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={`/teams/${team.id}`}
                        className={navLinkClass(active)}
                      >
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.icon?.slice(0, 1) ?? team.name.slice(0, 1)}
                        </span>
                        <span className="truncate">{team.name}</span>
                      </Link>
                    }
                  />
                  <TooltipContent side="right">{team.name}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <p className="px-2 text-xs text-muted-foreground">No teams yet</p>
        )}
      </ScrollArea>
    </aside>
  );
}
