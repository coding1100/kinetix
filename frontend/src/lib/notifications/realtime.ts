import type { InboxItemDto, NotificationDto } from "@/lib/api/home";
import {
  ingestLiveNotification,
  markAllNotificationsReadLocal,
  markNotificationReadLocal,
} from "@/lib/notifications/live-cache";
import { toast } from "sonner";

export type HomeNotificationPayload = {
  workspaceId: string;
  userIds: string[];
  notification: NotificationDto & { group?: InboxItemDto["group"] };
};

export type HomeInboxUpdatedPayload = {
  workspaceId: string;
  userId: string;
  itemId: string;
  unread?: boolean | null;
  bucket?: string | null;
};

export type HomeInboxClearedPayload = {
  workspaceId: string;
  userId: string;
};

const listeners = new Set<() => void>();

export function subscribeNotificationsRefresh(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bumpNotificationsRefresh() {
  listeners.forEach((listener) => listener());
}

export function applyHomeNotification(
  event: HomeNotificationPayload,
  currentUserId: string | undefined,
  currentWorkspaceId?: string | null
) {
  if (!currentUserId || !event.userIds.includes(currentUserId)) return;
  // Never surface another workspace's notifications in this one. Do not accept
  // events while the active workspace is unknown; the socket can connect before
  // workspace hydration finishes.
  if (!currentWorkspaceId || event.workspaceId !== currentWorkspaceId) return;
  const { notification } = event;
  ingestLiveNotification(notification);

  const isTabActiveAndFocused =
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus();

  if (isTabActiveAndFocused) {
    toast(notification.title, {
      description: notification.preview,
      duration: 6000,
    });
  }
  bumpNotificationsRefresh();
}

export function applyHomeInboxUpdated(
  event: HomeInboxUpdatedPayload,
  currentUserId: string | undefined,
  currentWorkspaceId?: string | null
) {
  if (!currentUserId || event.userId !== currentUserId) return;
  if (!currentWorkspaceId || event.workspaceId !== currentWorkspaceId) return;

  if (event.unread === false) {
    markNotificationReadLocal(event.itemId);
  }
  bumpNotificationsRefresh();
}

export function applyHomeInboxCleared(
  event: HomeInboxClearedPayload,
  currentUserId: string | undefined,
  currentWorkspaceId?: string | null
) {
  if (!currentUserId || event.userId !== currentUserId) return;
  if (!currentWorkspaceId || event.workspaceId !== currentWorkspaceId) return;

  markAllNotificationsReadLocal();
  bumpNotificationsRefresh();
}

