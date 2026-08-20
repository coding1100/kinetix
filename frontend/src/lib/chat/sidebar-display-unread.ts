import { useEffect, useState } from "react";
import type { UnreadBadgeHold } from "@/stores/chat-store";

export const UNREAD_BADGE_HIDE_DELAY_MS = 0;

export function resolveSidebarUnread(
  kind: "channel" | "dm",
  id: string,
  unread: number,
  isActive: boolean,
  hold: UnreadBadgeHold | null,
  now = Date.now()
): number {
  if (isActive) return 0;
  return unread;
}

export function useSidebarUnread(
  kind: "channel" | "dm",
  id: string,
  unread: number,
  isActive: boolean,
  hold: UnreadBadgeHold | null
): number {
  return resolveSidebarUnread(kind, id, unread, isActive, hold);
}
