/**
 * Home and Chat both render conversations, at /home/c/<id> and /chat/c/<id>.
 * Creating a channel from the Home sidebar should open it in Home rather than
 * throwing the user over to the Chat page, so the destination follows whichever
 * surface the action was taken from.
 */
export function isHomeSurface(pathname: string | null | undefined): boolean {
  return pathname === "/home" || (pathname?.startsWith("/home/") ?? false);
}

export function channelPathForSurface(
  pathname: string | null | undefined,
  channelId: string
): string {
  return `${isHomeSurface(pathname) ? "/home" : "/chat"}/c/${channelId}`;
}

/**
 * Rewrites a /chat/... href (as backend-built notification hrefs use) to its
 * /home/... equivalent for the same resource, preserving any query string.
 * Already-/home/... hrefs and paths outside the chat/home pair (e.g.
 * /people) pass through unchanged.
 */
export function toHomeHref(href: string): string {
  if (href === "/home" || href.startsWith("/home/")) return href;
  if (href === "/chat") return "/home";
  if (href.startsWith("/chat/")) return `/home${href.slice("/chat".length)}`;
  return href;
}
