import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Channel } from "@/lib/types/chat";

const fetchChannels = vi.fn();
const fetchDms = vi.fn();

vi.mock("@/lib/api/chat", () => ({
  fetchChannels: (...args: unknown[]) => fetchChannels(...args),
  fetchDms: (...args: unknown[]) => fetchDms(...args),
}));

const { clearSidebarInflight, loadSidebarLists } = await import(
  "./sidebar-lists-loader"
);
const { useChatStore } = await import("@/stores/chat-store");
const { useAuthStore } = await import("@/stores/auth-store");

const USER = "user-1";
const WORKSPACE = "ws-1";

function channel(id: string): Channel {
  return {
    id,
    name: `channel-${id}`,
    memberCount: 1,
    lastMessage: "",
    lastAt: "2026-06-09T12:00:00.000Z",
    unread: 0,
    starred: false,
    isPrivate: false,
    isFollowing: true,
  };
}

describe("loadSidebarLists", () => {
  beforeEach(() => {
    clearSidebarInflight();
    fetchChannels.mockReset();
    fetchDms.mockReset();
    fetchDms.mockResolvedValue({ data: [] });
    useAuthStore.setState({
      user: { id: USER, email: "u@x.com", fullName: "U", avatarUrl: null },
    });
    // A cache persisted from before someone added this user to ch-new.
    useChatStore.setState({
      sidebarListsCache: {
        userId: USER,
        workspaceId: WORKSPACE,
        channels: [channel("ch-old")],
        dms: [],
      },
    });
  });

  it("revalidates against the API even when a cache exists", async () => {
    fetchChannels.mockResolvedValue({
      data: [channel("ch-old"), channel("ch-new")],
    });

    const lists = await loadSidebarLists("token", WORKSPACE);

    expect(fetchChannels).toHaveBeenCalledTimes(1);
    expect(lists.channels.map((c) => c.id).sort()).toEqual([
      "ch-new",
      "ch-old",
    ]);
    expect(
      useChatStore
        .getState()
        .sidebarListsCache?.channels.map((c) => c.id)
        .sort()
    ).toEqual(["ch-new", "ch-old"]);
  });

  it("dedupes concurrent callers into one request", async () => {
    fetchChannels.mockResolvedValue({ data: [channel("ch-old")] });

    await Promise.all([
      loadSidebarLists("token", WORKSPACE),
      loadSidebarLists("token", WORKSPACE),
    ]);

    expect(fetchChannels).toHaveBeenCalledTimes(1);
  });
});
