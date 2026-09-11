"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OffScreenUnreadState } from "@/hooks/use-off-screen-unread";

/**
 * Floating "jump to unread" pills (ClickUp/Slack pattern) - rendered as
 * siblings positioned over the top/bottom edge of a scrollable sidebar
 * list. The parent must be `position: relative` and pass the state from
 * useOffScreenUnread() for the same scroll container.
 */
export function UnreadJumpPill({
  state,
  label = "Unread",
}: {
  state: OffScreenUnreadState;
  label?: string;
}) {
  return (
    <>
      {state.hasUnreadAbove ? (
        <button
          type="button"
          onClick={state.scrollToNearestAbove}
          className={cn(
            "absolute left-1/2 top-2 z-10 inline-flex w-max -translate-x-1/2 items-center gap-1.5 whitespace-nowrap",
            "rounded-full bg-primary/95 px-3 py-1 text-xs leading-none font-medium text-primary-foreground shadow-sm backdrop-blur-sm",
            "transition-all hover:bg-primary hover:shadow-md active:scale-95"
          )}
        >
          <ArrowUpIcon className="size-3 shrink-0" strokeWidth={2.5} />
          <span className="whitespace-nowrap">{label}</span>
        </button>
      ) : null}
      {state.hasUnreadBelow ? (
        <button
          type="button"
          onClick={state.scrollToNearestBelow}
          className={cn(
            "absolute bottom-2 left-1/2 z-10 inline-flex w-max -translate-x-1/2 items-center gap-1.5 whitespace-nowrap",
            "rounded-full bg-primary/95 px-3 py-1 text-xs leading-none font-medium text-primary-foreground shadow-sm backdrop-blur-sm",
            "transition-all hover:bg-primary hover:shadow-md active:scale-95"
          )}
        >
          <ArrowDownIcon className="size-3 shrink-0" strokeWidth={2.5} />
          <span className="whitespace-nowrap">{label}</span>
        </button>
      ) : null}
    </>
  );
}
