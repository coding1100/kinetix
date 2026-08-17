import { beforeEach, describe, expect, it } from "vitest";
import { mergeSidebarChannels, mergeSidebarDms } from "./sidebar-lists-loader";
import { useChatStore } from "@/stores/chat-store";
import type { Channel, DirectMessage } from "@/lib/types/chat";

function channel(id: string, unread: number): Channel {
  return {
    id,
    name: `channel-${id}`,
    memberCount: 1,
    lastMessage: "",
    lastAt: "2026-06-09T12:00:00.000Z",
    unread,
    starred: false,
    isPrivate: false,
    isFollowing: true,
  };
}

function dm(id: string, unread: number): DirectMessage {
  return {
    id,
    name: `dm-${id}`,
    isGroup: false,
    lastMessage: "",
    lastAt: "2026-06-09T12:00:00.000Z",
    unread,
  };
}

describe("mergeSidebarDms", () => {
  beforeEach(() => {
    useChatStore.setState({ activeConversation: null });
  });

  it("keeps a DM the API returned but the cache has never seen", () => {
    const merged = mergeSidebarDms([dm("dm-1", 1), dm("dm-2", 0)], [dm("dm-2", 0)]);
    expect(merged.map((d) => d.id).sort()).toEqual(["dm-1", "dm-2"]);
  });

  it("drops a DM the API no longer returns", () => {
    const merged = mergeSidebarDms([dm("dm-2", 0)], [dm("dm-1", 3), dm("dm-2", 0)]);
    expect(merged.map((d) => d.id)).toEqual(["dm-2"]);
  });

  it("shows the cache while the API response has not loaded", () => {
    const merged = mergeSidebarDms(undefined, [dm("dm-1", 2)]);
    expect(merged.map((d) => d.id)).toEqual(["dm-1"]);
  });

  it("uses unread count from API refetch when not active", () => {
    const merged = mergeSidebarDms([dm("dm-1", 25)], [dm("dm-1", 0)]);
    expect(merged[0]?.unread).toBe(25);
  });
});

describe("mergeSidebarChannels unread", () => {
  beforeEach(() => {
    useChatStore.setState({ activeConversation: null });
  });

  it("uses unread count from API refetch when not active", () => {
    const merged = mergeSidebarChannels(
      [channel("ch-1", 25)],
      [channel("ch-1", 0)]
    );
    expect(merged[0]?.unread).toBe(25);
  });

  it("keeps local unread while the channel is active", () => {
    useChatStore.setState({
      activeConversation: { kind: "channel", id: "ch-1" },
    });
    const merged = mergeSidebarChannels(
      [channel("ch-1", 25)],
      [channel("ch-1", 0)]
    );
    expect(merged[0]?.unread).toBe(0);
  });
});
