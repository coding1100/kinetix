/** Keep fresh API unread count authoritative unless conversation is currently active. */
export function mergeConversationUnread(
  freshApiUnread: number,
  cachedLocalUnread: number,
  options?: { isActive?: boolean }
): number {
  if (options?.isActive) return 0;
  return typeof freshApiUnread === "number" && !isNaN(freshApiUnread)
    ? freshApiUnread
    : cachedLocalUnread;
}
