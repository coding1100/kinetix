"use client";

import {
  ArrowUpRight,
  AtSign,
  Bell,
  Check,
  CheckCircle2,
  Hash,
  MessageSquare,
  MessageSquareReply,
  Send,
  Smile,
} from "lucide-react";
import type { InboxItemDto } from "@/lib/api/home";
import { resolveInboxHref } from "@/lib/notifications/inbox-item-utils";
import { cn, formatShortDateTimeUtc } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type InboxItemType = InboxItemDto["type"];

type Props = {
  item: InboxItemDto;
  onOpen: (item: InboxItemDto) => void;
  onClear: (event: React.MouseEvent, item: InboxItemDto) => void;
  compact?: boolean;
  variant?: "card" | "flat";
};

function itemIcon(type: InboxItemType) {
  switch (type) {
    case "mention":
      return AtSign;
    case "assignment":
      return CheckCircle2;
    case "chat":
      return MessageSquare;
    case "comment":
      return Hash;
    case "reminder":
      return Bell;
    case "sent":
      return Send;
    case "reply":
      return MessageSquareReply;
    case "reaction":
      return Smile;
    default:
      return MessageSquare;
  }
}

function itemIconTone(type: InboxItemType) {
  switch (type) {
    case "mention":
      return "bg-violet-500/10 text-violet-700";
    case "assignment":
      return "bg-emerald-500/10 text-emerald-700";
    case "chat":
    case "sent":
    case "reply":
      return "bg-sky-500/10 text-sky-700";
    case "comment":
      return "bg-amber-500/10 text-amber-700";
    case "reaction":
      return "bg-pink-500/10 text-pink-700";
    case "reminder":
    case "scheduled":
      return "bg-orange-500/10 text-orange-700";
    case "draft":
      return "bg-slate-500/10 text-slate-700";
    default:
      return "bg-sky-500/10 text-sky-700";
  }
}

export function InboxItemCard({
  item,
  onOpen,
  onClear,
  compact = false,
  variant = "card",
}: Props) {
  const Icon = itemIcon(item.type);
  const href = resolveInboxHref(item);
  const flat = variant === "flat";

  return (
    <article
      className={cn(
        "group relative w-full overflow-hidden transition-colors",
        flat
          ? "hover:bg-muted/40"
          : cn(
              "rounded-xl border duration-200",
              "border-primary/15 bg-gradient-to-r from-primary/[0.04] via-card to-card",
              "hover:border-primary/25 hover:shadow-sm"
            )
      )}
    >
      <div
        className={cn(
          "flex w-full items-center gap-3 sm:gap-4",
          flat
            ? "px-4 py-3"
            : compact
              ? "px-3 py-2.5"
              : "px-4 py-3.5 sm:px-5 sm:py-4"
        )}
      >
        <div
          className={cn(
            "grid shrink-0 place-items-center rounded-lg",
            flat || compact ? "size-8" : "size-10",
            itemIconTone(item.type)
          )}
        >
          <Icon className={compact ? "size-3.5" : "size-4"} strokeWidth={2} />
        </div>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => void onOpen(item)}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-2 flex w-2 shrink-0 justify-center">
              {item.unread ? (
                <span className="size-2 rounded-full bg-primary ring-2 ring-primary/25" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-semibold text-foreground",
                  compact ? "text-xs" : "text-sm"
                )}
              >
                {item.title}
              </p>
              <p
                className={cn(
                  "mt-0.5 line-clamp-1 text-muted-foreground",
                  compact ? "text-[11px]" : "text-sm"
                )}
              >
                {item.preview}
              </p>
              <p
                className={cn(
                  "mt-1 text-muted-foreground/70",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                {item.source}
              </p>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <time
            dateTime={item.createdAt}
            className={cn(
              "rounded-lg bg-muted/50 font-medium whitespace-nowrap text-muted-foreground",
              compact
                ? "px-2 py-0.5 text-[10px]"
                : "hidden px-2.5 py-1 text-[11px] sm:inline-flex"
            )}
          >
            {formatShortDateTimeUtc(item.createdAt)}
          </time>

          <div className="flex items-center gap-1.5">
            {!flat ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-1 rounded-lg px-2.5 font-medium",
                    compact ? "h-7 text-[10px]" : "h-8 text-xs",
                    item.unread
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "text-muted-foreground/40"
                  )}
                  onClick={(e) => void onClear(e, item)}
                  disabled={!item.unread}
                >
                  <Check className={compact ? "size-3" : "size-3.5"} />
                  Mark as read
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1 rounded-lg border-border/80 bg-background font-medium shadow-sm hover:bg-primary hover:text-primary-foreground",
                    compact ? "h-7 px-2 text-[10px]" : "h-8 px-2.5 text-xs"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onOpen({ ...item, href });
                  }}
                >
                  <ArrowUpRight className={compact ? "size-3" : "size-3.5"} />
                  Open
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "shrink-0",
                  item.unread
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-muted-foreground/30"
                )}
                onClick={(e) => void onClear(e, item)}
                disabled={!item.unread}
                aria-label="Mark as read"
              >
                <Check className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {!compact ? (
        <time
          dateTime={item.createdAt}
          className="border-t border-border/50 px-5 py-1.5 text-[10px] text-muted-foreground sm:hidden"
        >
          {formatShortDateTimeUtc(item.createdAt)}
        </time>
      ) : null}
    </article>
  );
}
