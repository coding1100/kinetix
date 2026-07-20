"use client";

import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";

function formatReactionNames(
  users: { id: string; fullName: string }[],
  currentUserId?: string
): string {
  const names = users.map((u) => (u.id === currentUserId ? "You" : u.fullName));
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Wraps a reaction badge with a hover tooltip listing who reacted. */
export function ReactionTooltip({
  emoji,
  users,
  trigger,
}: {
  emoji: string;
  users?: { id: string; fullName: string }[];
  trigger: ReactElement;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);

  if (!users || users.length === 0) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent
        className="inline-flex w-auto max-w-56 flex-col items-center gap-1 border border-border bg-popover px-3 py-2 text-center text-popover-foreground"
        arrowClassName="border border-border bg-popover fill-popover"
      >
        <span className="text-2xl leading-none">{emoji}</span>
        <span className="text-xs font-semibold">
          {formatReactionNames(users, currentUserId)}
        </span>
        <span className="text-[11px] opacity-70">reacted with {emoji}</span>
      </TooltipContent>
    </Tooltip>
  );
}
