/** Keep local unread authoritative when API refetch is stale (e.g. after mark-read). */
export function mergeConversationUnread(
  localUnread: number,
  apiUnread: number,
  options?: { isActive?: boolean }
): number {
  if (options?.isActive) return localUnread;
  return apiUnread > localUnread ? localUnread : apiUnread;
}
