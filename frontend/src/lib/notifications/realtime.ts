import type { InboxItemDto, NotificationDto } from "@/lib/api/home";
import { ingestLiveNotification } from "@/lib/notifications/live-cache";
import { toast } from "sonner";

export type HomeNotificationPayload = {
  workspaceId: string;
  userIds: string[];
  notification: NotificationDto & { group?: InboxItemDto["group"] };
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
  // Never surface another workspace's notifications in this one.
  if (currentWorkspaceId && event.workspaceId !== currentWorkspaceId) return;
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
