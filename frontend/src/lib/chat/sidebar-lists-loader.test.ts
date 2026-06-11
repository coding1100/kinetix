import { beforeEach, describe, expect, it } from "vitest";
import { mergeSidebarChannels } from "./sidebar-lists-loader";
import { useChatStore } from "@/stores/chat-store";
import type { Channel } from "@/lib/types/chat";

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

describe("mergeSidebarChannels unread", () => {
  beforeEach(() => {
    useChatStore.setState({ activeConversation: null });
  });

  it("does not raise unread from a stale API refetch", () => {
    const merged = mergeSidebarChannels(
      [channel("ch-1", 25)],
      [channel("ch-1", 0)]
    );
    expect(merged[0]?.unread).toBe(0);
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
