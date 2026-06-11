import type { Channel } from "@/lib/types/chat";
import { useAuthStore } from "@/stores/auth-store";
import {
  isSidebarCacheForSession,
  useChatStore,
  type ChatSidebarLists,
} from "@/stores/chat-store";

export function patchSidebarChannel(
  channelId: string,
  patch: Partial<Pick<Channel, "name" | "starred">>
) {
  useChatStore.setState((s) => {
    const channelMetaOverrides = {
      ...s.channelMetaOverrides,
      [channelId]: { ...s.channelMetaOverrides[channelId], ...patch },
    };
    if (!s.sidebarListsCache) {
      return { channelMetaOverrides };
    }
    return {
      channelMetaOverrides,
      sidebarListsCache: {
        ...s.sidebarListsCache,
        channels: s.sidebarListsCache.channels.map((c) =>
          c.id === channelId ? { ...c, ...patch } : c
        ),
      },
    };
  });
}

export function resolveChannelMeta(
  channelId: string,
  source?: Partial<Pick<Channel, "name" | "starred">> | null
) {
  const { channelMetaOverrides, sidebarListsCache } = useChatStore.getState();
  const cached = sidebarListsCache?.channels.find((c) => c.id === channelId);
  const override = channelMetaOverrides[channelId];
  return {
    name: override?.name ?? cached?.name ?? source?.name,
    starred: override?.starred ?? cached?.starred ?? source?.starred ?? false,
  };
}

export function bumpSidebarRefresh() {
  useChatStore.setState((s) => ({
    sidebarRefreshKey: s.sidebarRefreshKey + 1,
  }));
}

export function patchChannelActivityInSidebar(
  workspaceId: string,
  channelId: string,
  patch: {
    lastMessage: string;
    lastAt: string;
    bumpUnread?: boolean;
  }
) {
  const currentUserId = useAuthStore.getState().user?.id;

  useChatStore.setState((s) => {
    const cache = s.sidebarListsCache;
    if (!isSidebarCacheForSession(cache, currentUserId, workspaceId)) return s;

    const exists = cache!.channels.some((c) => c.id === channelId);
    if (!exists) return s;

    const channels = cache!.channels.map((c) =>
      c.id === channelId
        ? {
            ...c,
            lastMessage: patch.lastMessage,
            lastAt: patch.lastAt,
            unread: patch.bumpUnread ? c.unread + 1 : c.unread,
            canDelete: c.canDelete,
            createdById: c.createdById,
          }
        : c
    );
    channels.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

    return {
      sidebarListsCache: {
        ...cache!,
        channels,
      },
    };
  });
}

export function upsertChannelInSidebar(
  channel: Channel,
  workspaceId: string,
  options?: { skipRefresh?: boolean }
) {
  const currentUserId = useAuthStore.getState().user?.id;
  if (!currentUserId) return;
  const normalized: Channel = {
    ...channel,
    starred: channel.starred ?? false,
    lastMessage: channel.lastMessage ?? "",
    lastAt: channel.lastAt ?? new Date().toISOString(),
    unread: channel.unread ?? 0,
    memberCount: channel.memberCount ?? 1,
  };

  useChatStore.setState((s) => {
    const base: ChatSidebarLists = isSidebarCacheForSession(
      s.sidebarListsCache,
      currentUserId,
      workspaceId
    )
      ? s.sidebarListsCache!
      : {
          userId: currentUserId,
          workspaceId,
          channels: [] as Channel[],
          dms: [],
        };

    const exists = base.channels.some((c) => c.id === normalized.id);
    const channels = exists
      ? base.channels.map((c) =>
          c.id === normalized.id
            ? {
                ...c,
                ...normalized,
                canDelete: normalized.canDelete ?? c.canDelete,
                createdById: normalized.createdById ?? c.createdById,
              }
            : c
        )
      : [normalized, ...base.channels];

    channels.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

    return {
      sidebarListsCache: {
        ...base,
        channels,
      },
    };
  });
  if (!options?.skipRefresh) {
    bumpSidebarRefresh();
  }
}

export function removeChannelFromSidebar(channelId: string) {
  useChatStore.setState((s) => {
    const channelMetaOverrides = { ...s.channelMetaOverrides };
    delete channelMetaOverrides[channelId];
    const next: {
      channelMetaOverrides: typeof channelMetaOverrides;
      channelDetailsView?: null;
      sidebarListsCache?: ChatSidebarLists;
    } = { channelMetaOverrides };
    if (s.channelDetailsView) {
      next.channelDetailsView = null;
    }
    if (s.sidebarListsCache) {
      next.sidebarListsCache = {
        ...s.sidebarListsCache,
        channels: s.sidebarListsCache.channels.filter((c) => c.id !== channelId),
      };
    }
    return next;
  });
  bumpSidebarRefresh();
}

export function normalizeChannelNameInput(value: string) {
  return value.trim().replace(/^#+/, "").trim();
}
