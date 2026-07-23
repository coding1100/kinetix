/** Chat routes are mirrored under both /chat and /home (same ConversationView,
 * different shell/sidebar) so opening a conversation never yanks the user out
 * of whichever section they're already in. Defaults to /home - only stays on
 * /chat when that's where the user currently is. */
export function conversationPath(
  type: "channel" | "dm",
  id: string,
  currentPathname?: string | null
): string {
  const base = currentPathname?.startsWith("/chat") ? "/chat" : "/home";
  return type === "channel" ? `${base}/c/${id}` : `${base}/dm/${id}`;
}
