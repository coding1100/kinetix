import { clearSidebarInflight } from "@/lib/chat/sidebar-lists-loader";
import { useChatStore } from "@/stores/chat-store";

export function resetSessionScopedState() {
  useChatStore.getState().resetChatSession();
  clearSidebarInflight();
}
