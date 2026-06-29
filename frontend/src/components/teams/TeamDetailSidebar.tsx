"use client";

import { BarChart3Icon, FlameIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import type { TeamDetail } from "@/lib/api/teams";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import type { TeamDetailTab } from "@/components/teams/team-utils";
import { toast } from "sonner";

function formatCreated(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function TeamDetailSidebar({
  team,
  manage,
  onTabChange,
  onAddMember,
}: {
  team: TeamDetail;
  manage: boolean;
  onTabChange: (tab: TeamDetailTab) => void;
  onAddMember: () => void;
}) {
  const leadCount = team.members.filter((m) => m.role === "LEAD").length;

  return (
    <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-border bg-muted/10 xl:block">
      <div className="space-y-4 p-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Members</h3>
            {manage ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Add member"
                onClick={onAddMember}
              >
                <UserPlusIcon className="size-4" />
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {team.members.map((m) => (
              <Tooltip key={m.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onTabChange("team")}
                    >
                      <UserAvatarWithPresence
                        name={m.fullName}
                        avatarUrl={m.avatarUrl}
                        presence="offline"
                        avatarClassName="size-9"
                        showPresence={false}
                        fallbackClassName={avatarColorClassForKey(m.id, m.fullName)}
                        fallback={avatarInitialFromName(m.fullName)}
                      />
                    </button>
                  }
                />
                <TooltipContent side="bottom">
                  {m.fullName}
                  {m.role === "LEAD" ? " · Lead" : ""}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-xs font-medium text-primary hover:underline"
            onClick={() => onTabChange("team")}
          >
            View all members
          </button>
        </section>

        <section className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <FlameIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">Priorities</span> — set weekly goals for
              your team.{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => toast("Priorities — coming soon")}
              >
                Learn more
              </button>
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3Icon className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Team analytics</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Members</dt>
              <dd className="font-medium">{team.memberCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Leads</dt>
              <dd className="font-medium">{leadCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{formatCreated(team.createdAt)}</dd>
            </div>
          </dl>
          <Button
            variant="link"
            className="mt-2 h-auto p-0 text-xs"
            onClick={() => toast("Team analytics — coming soon")}
          >
            View full analytics
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Quick links</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/people" className="text-primary hover:underline">
                All People
              </Link>
            </li>
            <li>
              <Link href="/teams" className="text-primary hover:underline">
                All Teams
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </aside>
  );
}
