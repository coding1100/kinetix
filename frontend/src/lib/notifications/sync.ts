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
  } finally {
    // A refresh triggered right after the optimistic local update can race
    // ahead of the write above and refetch a pre-write count, which would
    // otherwise sit there until some unrelated future refresh happens to
    // fix it. Bump again now that the write has actually landed (or
    // failed) so the next fetch is guaranteed to reflect the true state.
    bumpNotificationsRefresh();
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
  } finally {
    bumpNotificationsRefresh();
  }
}
