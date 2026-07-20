"use client";

import type { ReactNode } from "react";
import {
  AtSign,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Hash,
  ListChecks,
  MessageSquare,
  MessageSquareReply,
  Send,
  Share2,
  Smile,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { InboxItemDto } from "@/lib/api/home";
import { cn, formatNotificationDate } from "@/lib/utils";

type InboxItemType = InboxItemDto["type"];

function renderItemIcon(type: InboxItemType, className: string) {
  switch (type) {
    case "mention":
      return <AtSign className={className} strokeWidth={2} />;
    case "assignment":
      return <CheckCircle2 className={className} strokeWidth={2} />;
    case "chat":
      return <MessageSquare className={className} strokeWidth={2} />;
    case "comment":
      return <Hash className={className} strokeWidth={2} />;
    case "reminder":
      return <Bell className={className} strokeWidth={2} />;
    case "sent":
      return <Send className={className} strokeWidth={2} />;
    case "reply":
      return <MessageSquareReply className={className} strokeWidth={2} />;
    case "reaction":
      return <Smile className={className} strokeWidth={2} />;
    default:
      return <ListChecks className={className} strokeWidth={2} />;
  }
}

// Bare colored glyph tone (ClickUp renders inbox row icons as colored glyphs,
// not filled avatar chips).
function itemIconTone(type: InboxItemType) {
  switch (type) {
    case "mention":
      return "text-violet-400";
    case "assignment":
      return "text-emerald-400";
    case "chat":
    case "sent":
    case "reply":
      return "text-sky-400";
    case "comment":
      return "text-amber-400";
    case "reaction":
      return "text-pink-400";
    case "reminder":
    case "scheduled":
      return "text-orange-400";
    case "draft":
      return "text-slate-400";
    default:
      return "text-orange-400";
  }
}

// Backend builds every preview as "{actorOrYou} <verb phrase> ..." or
// "{actor}: {snippet}" (see notification_service.py). Parse it so the verb
// phrase reads bold and any #channel / list name reads in the accent color,
// matching ClickUp's inbox typography — without needing a new DB column.
const VERB_PHRASES = [
  "added you to",
  "removed you from",
  "mentioned you in",
  "mentioned you",
  "assigned you to",
  "accepted your invite to",
  "started following you in",
  "unfollowed you in",
  "shared this task",
  "shared this list",
  "shared this",
  "deleted",
];

function parsePreview(preview: string): {
  actor: string;
  verb: string | null;
  rest: string;
} {
  const lower = preview.toLowerCase();
  let best = -1;
  let bestLen = 0;
  for (const phrase of VERB_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx > 0 && preview[idx - 1] === " " && idx <= 44 && (best === -1 || idx < best)) {
      best = idx;
      bestLen = phrase.length;
    }
  }
  if (best === -1) {
    const colon = preview.indexOf(": ");
    if (colon > 0 && colon <= 44) {
      return { actor: preview.slice(0, colon), verb: null, rest: preview.slice(colon + 1) };
    }
    return { actor: "", verb: null, rest: preview };
  }
  return {
    actor: preview.slice(0, best - 1),
    verb: preview.slice(best, best + bestLen),
    rest: preview.slice(best + bestLen),
  };
}

// Accent-color the first #channel / list name in the trailing text.
function renderRest(rest: string): ReactNode {
  const hashIdx = rest.indexOf("#");
  if (hashIdx === -1) return rest;
  const before = rest.slice(0, hashIdx);
  const after = rest.slice(hashIdx);
  const colon = after.indexOf(":");
  const name = colon > -1 ? after.slice(0, colon) : after;
  const tail = colon > -1 ? after.slice(colon) : "";
  return (
    <>
      {before}
      <span className="font-medium text-primary">{name}</span>
      {tail}
    </>
  );
}

function renderPreview(preview: string): ReactNode {
  const { actor, verb, rest } = parsePreview(preview);
  if (verb === null) {
    return (
      <>
        {actor ? <span className="font-semibold text-foreground">{actor}</span> : null}
        {actor ? " " : ""}
        {renderRest(rest.replace(/^:\s*/, ""))}
      </>
    );
  }
  return (
    <>
      {actor ? <span className="text-foreground">{actor} </span> : null}
      <span className="font-semibold text-foreground">{verb}</span>
      {renderRest(rest)}
    </>
  );
}

function renderConnectorIcon(item: InboxItemDto, className: string) {
  const p = item.preview.toLowerCase();
  if (p.includes("shared")) return <Share2 className={className} strokeWidth={2} />;
  if (p.includes("added")) return <UserPlus className={className} strokeWidth={2} />;
  if (p.includes("removed") || p.includes("unfollowed"))
    return <UserMinus className={className} strokeWidth={2} />;
  if (p.includes("mentioned")) return <AtSign className={className} strokeWidth={2} />;
  if (item.source.startsWith("#") || item.type === "chat")
    return <Hash className={className} strokeWidth={2} />;
  return <MessageSquare className={className} strokeWidth={2} />;
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
  const heading = item.source || item.title;

  return (
    <div
      className={cn(
        "group grid w-full grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_150px] items-center gap-4 px-4 py-2.5 transition-colors",
        "hover:bg-muted/50",
        item.unread ? "bg-muted/20" : "bg-transparent"
      )}
    >
      {/* Column A: type glyph + item (task / channel / list) name */}
      <button
        type="button"
        onClick={() => void onOpen(item)}
        className="flex min-w-0 items-center gap-2.5 text-left"
      >
        <span className={cn("shrink-0", itemIconTone(item.type))}>
          {renderItemIcon(item.type, "size-4")}
        </span>
        <span
          className={cn(
            "truncate text-sm",
            item.unread ? "font-medium text-foreground" : "text-foreground/85"
          )}
        >
          {heading}
        </span>
      </button>

      {/* Column B: action glyph + actor/verb sentence */}
      <button
        type="button"
        onClick={() => void onOpen(item)}
        className="flex min-w-0 items-center gap-2 text-left"
      >
        {renderConnectorIcon(item, "size-3.5 shrink-0 text-muted-foreground/70")}
        <span className="truncate text-sm text-muted-foreground">
          {renderPreview(item.preview)}
        </span>
      </button>

      {/* Column C: fixed width so hover actions overlay the date without reflow */}
      <div className="relative flex h-7 items-center justify-end">
        <time
          dateTime={item.createdAt}
          className="text-xs whitespace-nowrap text-muted-foreground transition-opacity group-hover:opacity-0"
        >
          {formatNotificationDate(item.createdAt)}
        </time>
        <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Snooze"
            title="Snooze"
            onClick={(e) => e.stopPropagation()}
          >
            <Clock className="size-4" />
          </button>
          <button
            type="button"
            className={cn(
              "flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90",
              !item.unread && "bg-muted text-muted-foreground hover:bg-muted"
            )}
            aria-label="Clear notification"
            onClick={(e) => void onClear(e, item)}
            disabled={!item.unread}
          >
            <Check className="size-3.5" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export function InboxFeedDateHeader({ label }: { label: string }) {
  return (
    <h2 className="px-4 pt-4 pb-1.5 text-[13px] font-medium text-muted-foreground">
      {label}
    </h2>
  );
}
