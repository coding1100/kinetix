import type { ChatMessage } from "@/lib/types/chat";
import { PKT_TIME_ZONE } from "@/lib/utils";

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCalendarDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dayKeyToDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysAgoFrom(now: Date, days: number): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() - days);
  return d;
}

export function formatChatDayLabel(date: Date, now = new Date()): string {
  const day = startOfDay(date);
  const today = startOfDay(now);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: PKT_TIME_ZONE,
  });
}

export function formatChatMessageTime(date: Date, now = new Date()): string {
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PKT_TIME_ZONE,
  });
  const day = startOfDay(date);
  const today = startOfDay(now);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return timePart;
  if (diffDays === 1) return `Yesterday at ${timePart}`;
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: PKT_TIME_ZONE,
    });
    return `${dayName} at ${timePart}`;
  }
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: PKT_TIME_ZONE,
  });
  return `${datePart} at ${timePart}`;
}

export function formatCompactMessageTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: PKT_TIME_ZONE,
  });
}


/** Completed calendar months between two dates (e.g. 30 days into month 2 is still 1, not 0). */
function completedMonthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** Completed calendar years between two dates. */
function completedYearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const monthDayBefore =
    to.getMonth() < from.getMonth() ||
    (to.getMonth() === from.getMonth() && to.getDate() < from.getDate());
  if (monthDayBefore) years -= 1;
  return years;
}

export function formatThreadReplyTime(date: Date, now = new Date()): string {
  const day = startOfDay(date);
  const today = startOfDay(now);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: PKT_TIME_ZONE,
    });
  }
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
  const months = completedMonthsBetween(date, now);
  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = completedYearsBetween(date, now);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export type ChatDayGroup = {
  dayKey: string;
  label: string;
  messages: ChatMessage[];
};

export function groupMessagesByDay(
  messages: ChatMessage[],
  now = new Date()
): ChatDayGroup[] {
  const groups: ChatDayGroup[] = [];
  let currentKey = "";

  for (const msg of messages) {
    const created = new Date(msg.createdAt);
    const key = getCalendarDayKey(created);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({
        dayKey: key,
        label: formatChatDayLabel(created, now),
        messages: [],
      });
    }
    groups[groups.length - 1].messages.push(msg);
  }

  return groups;
}

export type ChatJumpOption =
  | "today"
  | "yesterday"
  | "last-week"
  | "last-month"
  | "first";

export function resolveJumpDayKey(
  option: ChatJumpOption,
  groups: ChatDayGroup[],
  now = new Date()
): string | null {
  if (groups.length === 0) return null;

  if (option === "first") return groups[0].dayKey;

  const todayKey = getCalendarDayKey(now);
  const yesterdayKey = getCalendarDayKey(daysAgoFrom(now, 1));

  if (option === "today") {
    return groups.find((g) => g.dayKey === todayKey)?.dayKey ?? null;
  }
  if (option === "yesterday") {
    return groups.find((g) => g.dayKey === yesterdayKey)?.dayKey ?? null;
  }

  const cutoff =
    option === "last-week"
      ? daysAgoFrom(now, 7)
      : daysAgoFrom(now, 30);

  for (const group of groups) {
    if (dayKeyToDate(group.dayKey) >= cutoff) {
      return group.dayKey;
    }
  }
  return groups[0].dayKey;
}
