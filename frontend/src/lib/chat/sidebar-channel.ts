import type { Channel } from "@/lib/types/chat";
import { useChatStore, type ChatSidebarLists } from "@/stores/chat-store";

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

export function upsertChannelInSidebar(channel: Channel, workspaceId: string) {
  const normalized: Channel = {
    ...channel,
    starred: channel.starred ?? false,
    lastMessage: channel.lastMessage ?? "",
    lastAt: channel.lastAt ?? new Date().toISOString(),
    unread: channel.unread ?? 0,
    memberCount: channel.memberCount ?? 1,
  };

  useChatStore.setState((s) => {
    const base =
      s.sidebarListsCache?.workspaceId === workspaceId
        ? s.sidebarListsCache
        : {
            workspaceId,
            channels: [] as Channel[],
            dms: s.sidebarListsCache?.dms ?? [],
          };

    const exists = base.channels.some((c) => c.id === normalized.id);
    const channels = exists
      ? base.channels.map((c) =>
          c.id === normalized.id ? { ...c, ...normalized } : c
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
  bumpSidebarRefresh();
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
