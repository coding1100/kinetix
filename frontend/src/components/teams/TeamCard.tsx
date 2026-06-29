"use client";

import Link from "next/link";
import { ArrowRightIcon, UsersIcon } from "lucide-react";
import type { TeamSummary } from "@/lib/api/teams";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";

function memberNamesLine(team: TeamSummary) {
  const preview = team.membersPreview.slice(0, 2).map((m) => {
    const parts = m.fullName.trim().split(/\s+/);
    return parts[0] ?? m.fullName;
  });
  const extra = team.memberCount - preview.length;
  if (preview.length === 0) return "No members yet";
  if (extra > 0) return `${preview.join(", ")} +${extra}`;
  return preview.join(", ");
}

function memberTooltip(team: TeamSummary) {
  if (team.memberCount === 0) return "No members";
  const names = team.membersPreview.map((m) => m.fullName);
  const extra = team.memberCount - names.length;
  if (extra > 0) return `${names.join(", ")} +${extra} more`;
  return names.join(", ");
}

export function TeamCard({ team }: { team: TeamSummary }) {
  const iconLabel = team.icon?.slice(0, 2) ?? team.name.slice(0, 1).toUpperCase();

  return (
    <Link
      href={`/teams/${team.id}`}
      className={cn(
        "group relative flex min-h-[172px] flex-col overflow-hidden rounded-xl border border-border/80",
        "bg-card shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md"
      )}
    >
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: team.color }}
        aria-hidden
      />

      <div
        className="flex min-h-0 flex-1 flex-col p-4"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${team.color} 10%, transparent) 0%, transparent 72px)`,
        }}
      >
        <div className="mb-3 flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ring-2 ring-background"
            style={{ backgroundColor: team.color }}
          >
            {iconLabel}
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <h3 className="truncate text-base font-semibold tracking-tight group-hover:text-primary">
                    {team.name}
                  </h3>
                }
              />
              <TooltipContent side="top">{team.name}</TooltipContent>
            </Tooltip>

            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <UsersIcon className="size-3.5 shrink-0" aria-hidden />
              <span>
                {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
              </span>
            </p>
          </div>

          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground",
              "opacity-0 transition-all group-hover:opacity-100 group-hover:bg-muted/60 group-hover:text-foreground"
            )}
            aria-hidden
          >
            <ArrowRightIcon className="size-4" />
          </span>
        </div>

        {team.description ? (
          <p className="mb-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {team.description}
          </p>
        ) : (
          <p className="mb-3 flex-1 text-sm leading-relaxed text-muted-foreground/70">
            {memberNamesLine(team)}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex -space-x-2">
                    {team.membersPreview.slice(0, 4).map((m) => (
                      <UserAvatarWithPresence
                        key={m.id}
                        name={m.fullName}
                        avatarUrl={m.avatarUrl}
                        presence="offline"
                        avatarClassName="size-7 border-2 border-card"
                        showPresence={false}
                        fallbackClassName={avatarColorClassForKey(m.id, m.fullName)}
                        fallback={avatarInitialFromName(m.fullName)}
                      />
                    ))}
                    {team.memberCount > 4 ? (
                      <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
                        +{team.memberCount - 4}
                      </span>
                    ) : null}
                  </div>
                  {team.description ? (
                    <span className="hidden truncate text-xs text-muted-foreground sm:block">
                      {memberNamesLine(team)}
                    </span>
                  ) : null}
                </div>
              }
            />
            <TooltipContent side="bottom">{memberTooltip(team)}</TooltipContent>
          </Tooltip>

          <span className="shrink-0 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
            View team
          </span>
        </div>
      </div>
    </Link>
  );
}
