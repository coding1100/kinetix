"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getSocketBaseUrl } from "@/lib/socket/config";
import type {
  ChatMessageEditPayload,
  ChatReactionPayload,
  ChatRealtimePayload,
  PresenceSyncPayload,
  PresenceUpdatePayload,
} from "@/lib/types/realtime";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { usePresenceStore } from "@/stores/presence-store";
import { useProfileStore } from "@/stores/profile-store";

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const hydrated = useAuthStore((s) => s.hydrated);
  const presence = useProfileStore((s) => s.presence);
  const ingestRealtimeEvent = useChatStore((s) => s.ingestRealtimeEvent);
  const ingestMessageEditEvent = useChatStore((s) => s.ingestMessageEditEvent);
  const ingestReactionEvent = useChatStore((s) => s.ingestReactionEvent);
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
      ingestRealtimeEvent(payload);
    });
    socket.on("chat:message:edit", (payload: ChatMessageEditPayload) => {
      ingestMessageEditEvent(payload);
    });
    socket.on("chat:reaction", (payload: ChatReactionPayload) => {
      ingestReactionEvent(payload);
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
      socket.off("chat:message:edit");
      socket.off("chat:reaction");
      socket.off("presence:sync");
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
    ingestReactionEvent,
    syncPresence,
    upsertPresence,
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
