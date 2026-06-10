import type { InboxItemDto } from "@/lib/api/home";

export function resolveInboxHref(item: InboxItemDto): string {
  if (item.href) return item.href;
  if (item.type === "chat") return "/chat/channels";
  if (item.type === "mention" || item.type === "reply" || item.type === "reaction") {
    return "/chat";
  }
  if (item.type === "assignment") return "/home/my-tasks/assigned";
  if (item.source.startsWith("#")) return "/chat";
  return "/home/inbox";
}
