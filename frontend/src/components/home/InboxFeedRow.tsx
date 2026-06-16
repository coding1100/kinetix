"use client";

import {
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
import { cn, formatShortDateTimeUtc } from "@/lib/utils";

type InboxItemType = InboxItemDto["type"];

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

export function InboxFeedRow({
  item,
  onOpen,
  onClear,
}: {
  item: InboxItemDto;
  onOpen: (item: InboxItemDto) => void;
  onClear: (event: React.MouseEvent, item: InboxItemDto) => void;
}) {
  const Icon = itemIcon(item.type);

  return (
    <div
      className={cn(
        "group flex w-full items-start gap-4 px-6 py-3.5 transition-colors",
        "hover:bg-muted/50",
        item.unread && "bg-primary/[0.03]"
      )}
    >
      <button
        type="button"
        onClick={() => void onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <div
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
            itemIconTone(item.type)
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 flex w-2 shrink-0 justify-center">
              {item.unread ? (
                <span className="size-2 rounded-full bg-primary" aria-hidden />
              ) : (
                <span className="size-2 rounded-full bg-transparent" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm",
                  item.unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                )}
              >
                {item.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {item.preview}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">{item.source}</p>
            </div>
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <time
          dateTime={item.createdAt}
          className="text-xs whitespace-nowrap text-muted-foreground"
        >
          {formatShortDateTimeUtc(item.createdAt)}
        </time>
        <button
          type="button"
          className={cn(
            "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
            "opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground",
            !item.unread && "pointer-events-none opacity-0"
          )}
          aria-label="Mark as read"
          onClick={(e) => void onClear(e, item)}
        >
          <Check className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function InboxFeedDateHeader({ label }: { label: string }) {
  return (
    <h2 className="sticky top-0 z-[1] bg-background/95 px-6 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur-sm">
      {label}
    </h2>
  );
}
