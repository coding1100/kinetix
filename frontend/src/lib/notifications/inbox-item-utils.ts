import type { InboxItemDto } from "@/lib/api/home";

/** Backend always emits canonical /chat[/...] links - remap the /chat prefix
 * to /home unless the user is currently on the Chat page, so opening a
 * notification doesn't yank them out of Home into a separate section. */
function toCurrentShell(href: string, currentPathname?: string | null): string {
  if (!href.startsWith("/chat")) return href;
  if (currentPathname?.startsWith("/chat")) return href;
  return `/home${href.slice("/chat".length)}`;
}

export function resolveInboxHref(
  item: InboxItemDto,
  currentPathname?: string | null
): string {
  if (item.href) return toCurrentShell(item.href, currentPathname);
  if (item.type === "chat") return "/home/channels";
  if (item.type === "mention" || item.type === "reply" || item.type === "reaction") {
    return "/home";
  }
  if (item.type === "assignment") return "/home/my-tasks/assigned";
  if (item.source.startsWith("#")) return "/home";
  return "/home/inbox";
}
