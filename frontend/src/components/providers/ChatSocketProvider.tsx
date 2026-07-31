"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { getSocketConnectionConfig } from "@/lib/socket/config";
import type {
  ChatChannelJoinedPayload,
  ChatChannelMemberPayload,
  ChatChannelPrivacyPayload,
  ChatChannelRemovedPayload,
  ChatChannelRenamedPayload,
  ChatMessageDeletePayload,
  ChatMessageEditPayload,
  ChatReactionPayload,
  ChatReadPayload,
  ChatRealtimePayload,
  ChatTypingPayload,
  HomeNotificationPayload,
  PresenceSyncPayload,
  PresenceUpdatePayload,
  ResourceAccessChangedPayload,
  TaskRealtimePayload,
  AccountDisabledPayload,
  WorkspaceMemberReactivatedPayload,
  WorkspaceMemberRolePayload,
  WorkspaceMemberSuspendedPayload,
  WorkspaceStatusPayload,
} from "@/lib/types/realtime";
import { ingestTaskEvent } from "@/lib/tasks/realtime";
import { registerChatTypingSocket } from "@/lib/socket/chat-typing";
import { applyHomeNotification } from "@/lib/notifications/realtime";
import { playNotificationSound } from "@/lib/notifications/sound";
import { clearLiveNotifications } from "@/lib/notifications/live-cache";
import { bumpWorkspaceMembersRefresh } from "@/lib/workspace/realtime";
import { getMe } from "@/lib/api/auth";
import { bumpSidebarRefresh } from "@/lib/chat/sidebar-channel";
import {
  applyChannelJoinedToSidebar,
  applyChannelMemberUpdate,
  applyChannelPrivacyChanged,
  applyChannelRemovedFromSidebar,
  applyChannelRenamedToSidebar,
  applyRealtimeMessageToSidebar,
} from "@/lib/chat/sidebar-realtime";
import { firstSelectableWorkspaceId, useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { usePresenceStore } from "@/stores/presence-store";
import { useProfileStore } from "@/stores/profile-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpacesStore } from "@/stores/spaces-store";

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const hydrated = useAuthStore((s) => s.hydrated);
  const updateSession = useAuthStore((s) => s.updateSession);
  const clearSession = useAuthStore((s) => s.clearSession);
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
  const bumpSpacesRefresh = useSpacesStore((s) => s.bumpRefresh);
  const socketRef = useRef<Socket | null>(null);
  const presenceRef = useRef(presence);
  const joinedWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    presenceRef.current = presence;
  }, [presence]);

  useEffect(() => {
    setPresenceWorkspace(workspaceId);
    joinedWorkspaceRef.current = null;
    // Drop live notifications cached for the previous workspace.
    clearLiveNotifications();
  }, [workspaceId, setPresenceWorkspace]);

  useEffect(() => {
    if (!hydrated || !accessToken) return;
    const { url, path } = getSocketConnectionConfig();

    const socket: Socket = io(url, {
      path,
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    registerChatTypingSocket(socket);

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
    // A failed handshake is otherwise completely silent, which makes "realtime
    // stopped working" impossible to tell apart from "nothing was sent".
    socket.on("connect_error", (err: Error) => {
      console.warn(
        `[chat socket] could not connect to ${url}${path}: ${err.message}`
      );
    });
    socket.on("chat:message", (payload: ChatRealtimePayload) => {
      // Sound first: it must not depend on the sidebar/store updates below
      // succeeding, which they only partly do for a conversation that isn't
      // open (or for a thread reply, which the sidebar ignores entirely).
      const isOwnMessage = payload.message.authorId === userId;
      const soundEnabled = useSettingsStore.getState().soundEnabled;
      // TEMPORARY: diagnosing why the sound is skipped with the chat open.
      if (process.env.NODE_ENV !== "production") {
        console.log("[chat sound] event", {
          kind: payload.kind,
          conversationId: payload.conversationId,
          parentId: payload.parentId,
          authorId: payload.message.authorId,
          userId,
          isOwnMessage,
          soundEnabled,
          willPlay: !isOwnMessage && soundEnabled,
        });
      }
      if (!isOwnMessage && soundEnabled) {
        playNotificationSound();
      }
      applyRealtimeMessageToSidebar(payload, userId, accessToken);
      ingestRealtimeEvent(payload);
    });
    socket.on("chat:channel:joined", (payload: ChatChannelJoinedPayload) => {
      applyChannelJoinedToSidebar(payload, userId);
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
      const viewingRemoved = applyChannelMemberUpdate(
        payload,
        userId,
        accessToken
      );
      if (!viewingRemoved) return;
      toast.info("This channel is no longer available");
      const remaining = useChatStore.getState().sidebarListsCache?.channels;
      const nextChannel = remaining?.[0];
      router.push(nextChannel ? `/chat/c/${nextChannel.id}` : "/chat");
    });
    socket.on("chat:channel:renamed", (payload: ChatChannelRenamedPayload) => {
      applyChannelRenamedToSidebar(payload);
    });
    socket.on("chat:channel:privacy", (payload: ChatChannelPrivacyPayload) => {
      applyChannelPrivacyChanged(payload);
    });
    socket.on("home:notification", (payload: HomeNotificationPayload) => {
      applyHomeNotification(payload, userId, workspaceId);
    });
    socket.on(
      "workspace:member:role",
      (payload: WorkspaceMemberRolePayload) => {
        if (payload.workspaceId !== workspaceId) return;
        bumpWorkspaceMembersRefresh();
        if (payload.userId !== userId) return;
        // A role change can shift which Spaces/Lists and channels/DMs are
        // visible - bumping these two shared refresh keys re-fetches both
        // the Spaces tree and the channel/DM sidebar lists, which Home and
        // Chat pages both read off of (HomeSidebar and ChatSidebar share
        // the same spacesRefreshKey/sidebarRefreshKey stores).
        bumpSpacesRefresh();
        bumpSidebarRefresh();
        void getMe(accessToken).then((me) => {
          updateSession({
            accessToken,
            user: {
              id: me.id,
              email: me.email,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
            },
            workspaces: me.workspaces,
            activeWorkspaceId: workspaceId,
          });
          toast.info("Your role in this workspace was updated");
        });
      }
    );
    const handleWorkspaceGone = (reason: "suspended" | "deleted") =>
      (payload: WorkspaceStatusPayload) => {
        if (payload.workspaceId !== workspaceId) return;
        toast.error(
          reason === "suspended"
            ? "This workspace has been suspended"
            : "This workspace no longer exists"
        );
        void getMe(accessToken).then((me) => {
          updateSession({
            accessToken,
            user: {
              id: me.id,
              email: me.email,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
            },
            workspaces: me.workspaces,
          });
          const nextWorkspaceId = firstSelectableWorkspaceId(me.workspaces);
          if (nextWorkspaceId) {
            router.push("/home/inbox");
          } else {
            clearSession();
            router.push("/auth/login");
          }
        });
      };
    socket.on("workspace:suspended", handleWorkspaceGone("suspended"));
    socket.on("workspace:deleted", handleWorkspaceGone("deleted"));
    socket.on(
      "workspace:member:suspended",
      (payload: WorkspaceMemberSuspendedPayload) => {
        // Targeted at this user's own room by the backend, so it's always
        // "us" - but only act on it if it's the workspace we're currently
        // sitting in; otherwise it'll just be missing next time /me loads.
        if (payload.workspaceId !== workspaceId) return;
        toast.error("Your access to this workspace was suspended");
        void getMe(accessToken).then((me) => {
          updateSession({
            accessToken,
            user: {
              id: me.id,
              email: me.email,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
            },
            workspaces: me.workspaces,
          });
          const nextWorkspaceId = firstSelectableWorkspaceId(me.workspaces);
          if (nextWorkspaceId) {
            router.push("/home/inbox");
          } else {
            clearSession();
            router.push("/auth/login");
          }
        });
      }
    );
    socket.on(
      "workspace:member:reactivated",
      (_payload: WorkspaceMemberReactivatedPayload) => {
        // Targeted at this user's own room by the backend. Not gated on
        // the currently-active workspace - unlike suspend, this doesn't
        // need to kick anyone anywhere, it just needs the workspace
        // switcher to un-gray the workspace, wherever they're sitting.
        toast.success("Your access to a workspace was restored");
        void getMe(accessToken).then((me) => {
          updateSession({
            accessToken,
            user: {
              id: me.id,
              email: me.email,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
            },
            workspaces: me.workspaces,
          });
        });
      }
    );
    socket.on("account:disabled", (payload: AccountDisabledPayload) => {
      if (payload.userId !== userId) return;
      toast.error("Your account has been disabled");
      clearSession();
      router.push("/auth/login");
    });
    socket.on(
      "space:access:removed",
      (payload: ResourceAccessChangedPayload) => {
        if (payload.workspaceId !== workspaceId) return;
        if (!userId || !payload.userIds.includes(userId)) return;
        bumpSpacesRefresh();
      }
    );
    socket.on(
      "space:access:granted",
      (payload: ResourceAccessChangedPayload) => {
        if (payload.workspaceId !== workspaceId) return;
        if (!userId || !payload.userIds.includes(userId)) return;
        bumpSpacesRefresh();
      }
    );
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
    socket.on("task:event", (payload: TaskRealtimePayload) => {
      if (payload.workspaceId !== workspaceId) return;
      ingestTaskEvent(payload);
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
      socket.off("connect_error");
      socket.off("chat:message");
      socket.off("chat:channel:joined");
      socket.off("chat:channel:removed");
      socket.off("chat:channel:member");
      socket.off("chat:channel:renamed");
      socket.off("chat:channel:privacy");
      socket.off("home:notification");
      socket.off("workspace:member:role");
      socket.off("workspace:suspended");
      socket.off("workspace:deleted");
      socket.off("workspace:member:suspended");
      socket.off("workspace:member:reactivated");
      socket.off("account:disabled");
      socket.off("space:access:removed");
      socket.off("space:access:granted");
      socket.off("chat:message:edit");
      socket.off("chat:message:delete");
      socket.off("chat:reaction");
      socket.off("chat:typing");
      socket.off("chat:read");
      socket.off("task:event");
      socket.off("presence:sync");
      registerChatTypingSocket(null);
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
    updateSession,
    bumpSpacesRefresh,
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
