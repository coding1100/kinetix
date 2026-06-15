"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { getSocketBaseUrl } from "@/lib/socket/config";
import type {
  ChatChannelJoinedPayload,
  ChatChannelMemberPayload,
  ChatChannelRemovedPayload,
  ChatDmJoinedPayload,
  ChatMessageDeletePayload,
  ChatMessageEditPayload,
  ChatReactionPayload,
  ChatReadPayload,
  ChatRealtimePayload,
  ChatTypingPayload,
  HomeNotificationPayload,
  PresenceSyncPayload,
  PresenceUpdatePayload,
} from "@/lib/types/realtime";
import { registerChatTypingSocket } from "@/lib/socket/chat-typing";
import { joinDmRoom, registerDmRoomsSocket } from "@/lib/socket/dm-rooms";
import { applyHomeNotification } from "@/lib/notifications/realtime";
import {
  applyChannelJoinedToSidebar,
  applyChannelMemberUpdate,
  applyChannelRemovedFromSidebar,
  applyRealtimeMessageToSidebar,
} from "@/lib/chat/sidebar-realtime";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { usePresenceStore } from "@/stores/presence-store";
import { useProfileStore } from "@/stores/profile-store";

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const hydrated = useAuthStore((s) => s.hydrated);
  const presence = useProfileStore((s) => s.presence);
  const ingestRealtimeEvent = useChatStore((s) => s.ingestRealtimeEvent);
  const ingestMessageEditEvent = useChatStore((s) => s.ingestMessageEditEvent);
  const ingestMessageDeleteEvent = useChatStore(
    (s) => s.ingestMessageDeleteEvent
  );
  const ingestReactionEvent = useChatStore((s) => s.ingestReactionEvent);
  const ingestTypingEvent = useChatStore((s) => s.ingestTypingEvent);
  const ingestReadEvent = useChatStore((s) => s.ingestReadEvent);
  const syncPresence = usePresenceStore((s) => s.syncPresence);
  const upsertPresence = usePresenceStore((s) => s.upsertPresence);
  const setPresenceWorkspace = usePresenceStore((s) => s.setWorkspace);
  const socketRef = useRef<Socket | null>(null);
  const presenceRef = useRef(presence);
  const joinedWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    presenceRef.current = presence;
  }, [presence]);

  useEffect(() => {
    setPresenceWorkspace(workspaceId);
    joinedWorkspaceRef.current = null;
  }, [workspaceId, setPresenceWorkspace]);

  useEffect(() => {
    if (!hydrated || !accessToken) return;

    const socket: Socket = io(getSocketBaseUrl(), {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    registerChatTypingSocket(socket);
    registerDmRoomsSocket(socket);

    const joinWorkspace = () => {
      if (!workspaceId) return;
      socket.emit(
        "workspace:join",
        { workspaceId, status: presenceRef.current },
        (response?: { ok?: boolean }) => {
          if (response?.ok) {
            joinedWorkspaceRef.current = workspaceId;
            if (userId) {
              upsertPresence(workspaceId, userId, presenceRef.current);
            }
          }
        }
      );
    };

    socket.on("connect", joinWorkspace);
    socket.on("chat:message", (payload: ChatRealtimePayload) => {
      applyRealtimeMessageToSidebar(payload, userId, accessToken);
      ingestRealtimeEvent(payload);
    });
    socket.on("chat:channel:joined", (payload: ChatChannelJoinedPayload) => {
      applyChannelJoinedToSidebar(payload, userId);
    });
    socket.on("chat:dm:joined", (payload: ChatDmJoinedPayload) => {
      if (!userId || !payload.userIds.includes(userId)) return;
      joinDmRoom(payload.workspaceId, payload.conversationId);
    });
    socket.on("chat:channel:removed", (payload: ChatChannelRemovedPayload) => {
      const viewingRemoved = applyChannelRemovedFromSidebar(payload, userId);
      if (!viewingRemoved) return;
      toast.info("This channel is no longer available");
      const remaining = useChatStore.getState().sidebarListsCache?.channels;
      const nextChannel = remaining?.[0];
      router.push(nextChannel ? `/chat/c/${nextChannel.id}` : "/chat");
    });
    socket.on("chat:channel:member", (payload: ChatChannelMemberPayload) => {
      applyChannelMemberUpdate(payload, userId, accessToken);
    });
    socket.on("home:notification", (payload: HomeNotificationPayload) => {
      applyHomeNotification(payload, userId);
    });
    socket.on("chat:message:edit", (payload: ChatMessageEditPayload) => {
      ingestMessageEditEvent(payload);
    });
    socket.on("chat:message:delete", (payload: ChatMessageDeletePayload) => {
      ingestMessageDeleteEvent(payload);
    });
    socket.on("chat:reaction", (payload: ChatReactionPayload) => {
      ingestReactionEvent(payload);
    });
    socket.on("chat:typing", (payload: ChatTypingPayload) => {
      ingestTypingEvent(payload);
    });
    socket.on("chat:read", (payload: ChatReadPayload) => {
      ingestReadEvent(payload);
    });
    socket.on("presence:sync", (payload: PresenceSyncPayload) => {
      syncPresence(payload.workspaceId, payload.users);
    });
    socket.on("presence:update", (payload: PresenceUpdatePayload) => {
      upsertPresence(payload.workspaceId, payload.userId, payload.status);
    });

    if (socket.connected) joinWorkspace();

    return () => {
      joinedWorkspaceRef.current = null;
      socket.off("connect", joinWorkspace);
      socket.off("chat:message");
      socket.off("chat:channel:joined");
      socket.off("chat:dm:joined");
      socket.off("chat:channel:removed");
      socket.off("chat:channel:member");
      socket.off("home:notification");
      socket.off("chat:message:edit");
      socket.off("chat:message:delete");
      socket.off("chat:reaction");
      socket.off("chat:typing");
      socket.off("chat:read");
      socket.off("presence:sync");
      registerChatTypingSocket(null);
      registerDmRoomsSocket(null);
      socket.off("presence:update");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    hydrated,
    accessToken,
    workspaceId,
    userId,
    ingestRealtimeEvent,
    ingestMessageEditEvent,
    ingestMessageDeleteEvent,
    ingestReactionEvent,
    ingestTypingEvent,
    ingestReadEvent,
    syncPresence,
    upsertPresence,
    router,
  ]);

  useEffect(() => {
    const socket = socketRef.current;
    if (
      !socket?.connected ||
      !workspaceId ||
      joinedWorkspaceRef.current !== workspaceId
    ) {
      return;
    }
    socket.emit("presence:set", { workspaceId, status: presence });
    if (userId) {
      upsertPresence(workspaceId, userId, presence);
    }
  }, [presence, workspaceId, userId, upsertPresence]);

  return <>{children}</>;
}
