"use client";

import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MemberTeamChip = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

const MAX_INLINE = 2;

function teamInitial(team: MemberTeamChip) {
  return team.icon?.slice(0, 1) ?? team.name.slice(0, 1).toUpperCase();
}

function TeamIcon({
  team,
  size = "sm",
}: {
  team: MemberTeamChip;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded font-bold text-white",
        size === "sm" ? "size-4 text-[9px]" : "size-3.5 text-[8px]"
      )}
      style={{ backgroundColor: team.color }}
    >
      {teamInitial(team)}
    </span>
  );
}

function TeamChip({ team }: { team: MemberTeamChip }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/teams/${team.id}`}
            className={cn(
              "inline-flex h-6 max-w-[108px] items-center gap-1 rounded-md border border-border/60",
              "bg-background px-1.5 text-[11px] font-medium text-foreground",
              "transition-colors hover:border-border hover:bg-muted/50"
            )}
          >
            <TeamIcon team={team} />
            <span className="truncate">{team.name}</span>
          </Link>
        }
      />
      <TooltipContent side="top">{team.name}</TooltipContent>
    </Tooltip>
  );
}

function OverflowTeams({ teams }: { teams: MemberTeamChip[] }) {
  if (teams.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-md border border-border/60",
              "bg-muted/40 px-1.5 text-[11px] font-medium text-muted-foreground",
              "transition-colors hover:bg-muted hover:text-foreground"
            )}
          >
            +{teams.length}
          </button>
        }
      />
      <PopoverContent align="start" className="w-56 p-2">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Teams
        </p>
        <ul className="max-h-48 space-y-0.5 overflow-y-auto">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <TeamIcon team={team} />
                <span className="min-w-0 truncate">{team.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function MemberTeamBadges({ teams }: { teams: MemberTeamChip[] }) {
  if (teams.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const inline = teams.slice(0, MAX_INLINE);
  const overflow = teams.slice(MAX_INLINE);

  return (
    <div className="flex max-w-[240px] items-center gap-1">
      {inline.map((team) => (
        <TeamChip key={team.id} team={team} />
      ))}
      <OverflowTeams teams={overflow} />
    </div>
  );
}

export function TeamFilterLabel({ team }: { team: MemberTeamChip }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamIcon team={team} size="xs" />
      <span className="truncate">{team.name}</span>
    </span>
  );
}
