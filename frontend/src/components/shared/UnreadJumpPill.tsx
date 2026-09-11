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
  label = "Unread messages",
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
            "absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5",
            "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md",
            "transition-transform hover:scale-105 active:scale-95"
          )}
        >
          <ArrowUpIcon className="size-3.5" />
          {label}
        </button>
      ) : null}
      {state.hasUnreadBelow ? (
        <button
          type="button"
          onClick={state.scrollToNearestBelow}
          className={cn(
            "absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5",
            "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md",
            "transition-transform hover:scale-105 active:scale-95"
          )}
        >
          <ArrowDownIcon className="size-3.5" />
          {label}
        </button>
      ) : null}
    </>
  );
}
