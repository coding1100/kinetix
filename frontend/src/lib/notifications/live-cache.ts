import type { InboxItemDto, NotificationDto } from "@/lib/api/home";

const liveById = new Map<string, NotificationDto>();
const readLocallyIds = new Set<string>();
let bulkClearedAt = 0;

function withReadState(item: NotificationDto): NotificationDto {
  if (isReadLocally(item.id)) {
    return { ...item, unread: false };
  }
  return item;
}

export function ingestLiveNotification(notification: NotificationDto) {
  liveById.set(notification.id, {
    ...notification,
    createdAt: notification.createdAt || new Date().toISOString(),
  });
}

export function clearLiveNotifications() {
  liveById.clear();
  readLocallyIds.clear();
  bulkClearedAt = 0;
}

function isReadLocally(id: string) {
  return bulkClearedAt > 0 || readLocallyIds.has(id);
}

function sortNewestFirst<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function mergeNotifications(api: NotificationDto[]): NotificationDto[] {
  const merged = new Map<string, NotificationDto>();
  for (const item of api) merged.set(item.id, withReadState(item));
  for (const item of liveById.values()) {
    merged.set(item.id, withReadState(item));
  }
  return sortNewestFirst([...merged.values()]);
}

export function mergeInboxItems(api: InboxItemDto[]): InboxItemDto[] {
  const merged = new Map<string, InboxItemDto>();
  for (const item of api) {
    merged.set(
      item.id,
      isReadLocally(item.id) ? { ...item, unread: false } : item
    );
  }
  for (const item of liveById.values()) {
    merged.set(item.id, notificationToInboxItem(withReadState(item)));
  }
  return sortNewestFirst([...merged.values()]);
}

export function notificationToInboxItem(
  notification: NotificationDto & { group?: InboxItemDto["group"] }
): InboxItemDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    preview: notification.preview,
    source: notification.source,
    createdAt: notification.createdAt,
    unread: notification.unread,
    group: notification.group ?? "today",
    href: notification.href,
  };
}

export function markNotificationReadLocal(id: string) {
  readLocallyIds.add(id);
  const existing = liveById.get(id);
  if (existing?.unread) {
    liveById.set(id, { ...existing, unread: false });
  }
}

export function markAllNotificationsReadLocal(knownIds: Iterable<string> = []) {
  bulkClearedAt = Date.now();
  for (const id of knownIds) readLocallyIds.add(id);
  for (const [id, item] of liveById) {
    readLocallyIds.add(id);
    if (item.unread) liveById.set(id, { ...item, unread: false });
  }
}

export function liveUnreadDelta(api: NotificationDto[]) {
  const apiIds = new Set(api.map((n) => n.id));
  let delta = 0;
  for (const item of liveById.values()) {
    if (!apiIds.has(item.id) && item.unread) delta += 1;
  }
  return delta;
}

export function countUnreadNotifications(
  api: NotificationDto[],
  apiUnreadCount: number
) {
  if (bulkClearedAt > 0) {
    return liveUnreadDelta(api);
  }
  const markedRead = api.filter((n) => n.unread && readLocallyIds.has(n.id)).length;
  return Math.max(0, apiUnreadCount - markedRead) + liveUnreadDelta(api);
}

export function reconcileReadStateFromApi(
  api: NotificationDto[],
  unreadCount?: number
) {
  if (unreadCount === 0) {
    bulkClearedAt = 0;
  }
  for (const item of api) {
    if (!item.unread) readLocallyIds.delete(item.id);
  }
}
