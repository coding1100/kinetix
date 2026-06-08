import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createDm } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import { setConversationCache } from "@/lib/chat/conversation-cache";
import { findDmByUserId, upsertDmInSidebar } from "@/lib/chat/sidebar-dm";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { toast } from "sonner";

function resolveExistingDm(workspaceId: string, userId: string) {
  return findDmByUserId(workspaceId, userId);
}

export async function openDirectMessageForUser(
  userId: string,
  router: AppRouterInstance
): Promise<boolean> {
  const accessToken = useAuthStore.getState().accessToken;
  const workspaceId = useAuthStore.getState().activeWorkspaceId;
  const currentUserId = useAuthStore.getState().user?.id;

  if (!accessToken || !workspaceId || !currentUserId || userId === currentUserId) {
    return false;
  }

  const { setActiveThread, setChannelDetailsView, closePersonProfile } =
    useChatStore.getState();

  setActiveThread(null);
  setChannelDetailsView(null);

  try {
    const existing = resolveExistingDm(workspaceId, userId);
    if (existing) {
      setConversationCache(workspaceId, "dm", existing.id, { dm: existing });
      closePersonProfile();
      router.push(`/chat/dm/${existing.id}`);
      return true;
    }

    const dm = await createDm(accessToken, workspaceId, [userId]);
    upsertDmInSidebar(dm, workspaceId);
    setConversationCache(workspaceId, "dm", dm.id, { dm });
    closePersonProfile();
    router.push(`/chat/dm/${dm.id}`);
    return true;
  } catch (err) {
    toast.error(
      err instanceof ApiError ? err.message : "Failed to open direct message"
    );
    return false;
  }
}
