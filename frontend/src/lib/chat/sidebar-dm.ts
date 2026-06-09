import type { DirectMessage } from "@/lib/types/chat";
import { useChatStore, type ChatSidebarLists } from "@/stores/chat-store";
import { bumpSidebarRefresh } from "@/lib/chat/sidebar-channel";

export function findDmByUserId(
  workspaceId: string,
  userId: string
): DirectMessage | undefined {
  const cache = useChatStore.getState().sidebarListsCache;
  if (cache?.workspaceId !== workspaceId) return undefined;
  return cache.dms.find((d) => !d.isGroup && d.otherUserId === userId);
}

function mergeDmIntoSidebar(
  dm: DirectMessage,
  workspaceId: string,
  options?: { refresh?: boolean }
) {
  const normalized: DirectMessage = {
    ...dm,
    lastMessage: dm.lastMessage ?? "",
    lastAt: dm.lastAt ?? new Date().toISOString(),
    unread: dm.unread ?? 0,
    starred: dm.starred ?? false,
  };

  useChatStore.setState((s) => {
    const base: ChatSidebarLists =
      s.sidebarListsCache?.workspaceId === workspaceId
        ? s.sidebarListsCache
        : {
            workspaceId,
            channels: s.sidebarListsCache?.channels ?? [],
            dms: [],
          };

    const exists = base.dms.some((d) => d.id === normalized.id);
    const dms = exists
      ? base.dms.map((d) => (d.id === normalized.id ? { ...d, ...normalized } : d))
      : [normalized, ...base.dms];

    dms.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

    return {
      sidebarListsCache: {
        ...base,
        dms,
      },
    };
  });

  if (options?.refresh !== false) {
    bumpSidebarRefresh();
  }
}

export function upsertDmInSidebar(dm: DirectMessage, workspaceId: string) {
  mergeDmIntoSidebar(dm, workspaceId);
}

export function patchDmActivityInSidebar(
  workspaceId: string,
  dmId: string,
  patch: {
    lastMessage: string;
    lastAt: string;
    bumpUnread?: boolean;
  }
) {
  useChatStore.setState((s) => {
    const cache = s.sidebarListsCache;
    if (!cache || cache.workspaceId !== workspaceId) return s;

    const exists = cache.dms.some((d) => d.id === dmId);
    if (!exists) return s;

    const dms = cache.dms.map((d) =>
      d.id === dmId
        ? {
            ...d,
            lastMessage: patch.lastMessage,
            lastAt: patch.lastAt,
            unread: patch.bumpUnread ? d.unread + 1 : d.unread,
          }
        : d
    );
    dms.sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

    return {
      sidebarListsCache: {
        ...cache,
        dms,
      },
    };
  });
}

export function patchSidebarDm(
  dmId: string,
  patch: Partial<Pick<DirectMessage, "starred">>
) {
  useChatStore.setState((s) => {
    if (!s.sidebarListsCache) return s;
    return {
      sidebarListsCache: {
        ...s.sidebarListsCache,
        dms: s.sidebarListsCache.dms.map((d) =>
          d.id === dmId ? { ...d, ...patch } : d
        ),
      },
    };
  });
  bumpSidebarRefresh();
}

export function removeDmFromSidebar(dmId: string) {
  useChatStore.setState((s) => {
    if (!s.sidebarListsCache) return s;
    return {
      sidebarListsCache: {
        ...s.sidebarListsCache,
        dms: s.sidebarListsCache.dms.filter((d) => d.id !== dmId),
      },
    };
  });
  bumpSidebarRefresh();
}
