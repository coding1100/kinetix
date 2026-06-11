import { useEffect, useState } from "react";
import type { UnreadBadgeHold } from "@/stores/chat-store";

export const UNREAD_BADGE_HIDE_DELAY_MS = 2000;

export function resolveSidebarUnread(
  kind: "channel" | "dm",
  id: string,
  unread: number,
  isActive: boolean,
  hold: UnreadBadgeHold | null,
  now = Date.now()
): number {
  if (!isActive) return unread;

  if (hold && hold.kind === kind && hold.id === id) {
    return now < hold.expiresAt ? hold.count : 0;
  }

  return unread;
}

export function useSidebarUnread(
  kind: "channel" | "dm",
  id: string,
  unread: number,
  isActive: boolean,
  hold: UnreadBadgeHold | null
): number {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isActive || !hold) return;
    if (hold.kind !== kind || hold.id !== id) return;
    const remaining = hold.expiresAt - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => tick((n) => n + 1), remaining);
    return () => window.clearTimeout(timer);
  }, [isActive, hold, kind, id]);

  return resolveSidebarUnread(kind, id, unread, isActive, hold);
}
