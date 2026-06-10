import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/home";
import {
  markAllNotificationsReadLocal,
  markNotificationReadLocal,
} from "@/lib/notifications/live-cache";
import { bumpNotificationsRefresh } from "@/lib/notifications/realtime";

export async function markNotificationReadAndSync(
  token: string,
  workspaceId: string,
  itemId: string
) {
  markNotificationReadLocal(itemId);
  bumpNotificationsRefresh();
  try {
    await markNotificationRead(token, workspaceId, itemId);
  } catch {
    /* local UI already updated; refetch on next refresh */
  }
}

export async function markAllNotificationsReadAndSync(
  token: string,
  workspaceId: string,
  knownIds: Iterable<string> = []
) {
  markAllNotificationsReadLocal(knownIds);
  bumpNotificationsRefresh();
  try {
    await markAllNotificationsRead(token, workspaceId);
  } catch {
    /* local UI already updated; refetch on next refresh */
  }
}
