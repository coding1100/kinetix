import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectMessage } from "@/lib/types/chat";
import type { ChatRealtimePayload } from "@/lib/types/realtime";

const fetchDm = vi.fn();

vi.mock("@/lib/api/chat", () => ({
  fetchChannel: vi.fn(),
  fetchDm: (...args: unknown[]) => fetchDm(...args),
}));

const { applyRealtimeMessageToSidebar } = await import("./sidebar-realtime");
const { useChatStore } = await import("@/stores/chat-store");
const { useAuthStore } = await import("@/stores/auth-store");

const USER = "user-1";
const SENDER = "user-2";
const WORKSPACE = "ws-1";
const TOKEN = "token";

function dm(id: string, unread: number): DirectMessage {
  return {
    id,
    name: `dm-${id}`,
    isGroup: false,
    lastMessage: "older",
    lastAt: "2026-06-09T12:00:00.000Z",
    unread,
  };
}

function event(conversationId: string, authorId: string): ChatRealtimePayload {
  return {
    workspaceId: WORKSPACE,
    kind: "dm",
    conversationId,
    message: {
      id: "msg-1",
      authorId,
      authorName: "Sender",
      body: "hello there",
      createdAt: "2026-06-09T13:00:00.000Z",
      reactions: [],
      threadCount: 0,
    },
    parentId: null,
  } as unknown as ChatRealtimePayload;
}

function sidebarDms() {
  return useChatStore.getState().sidebarListsCache?.dms ?? [];
}

describe("applyRealtimeMessageToSidebar - DM unread", () => {
  beforeEach(() => {
    fetchDm.mockReset();
    useAuthStore.setState({
      user: { id: USER, email: "u@x.com", fullName: "U", avatarUrl: null },
    });
    useChatStore.setState({
      activeConversation: null,
      sidebarListsCache: {
        userId: USER,
        workspaceId: WORKSPACE,
        channels: [],
        dms: [dm("dm-1", 0)],
      },
    });
  });

  it("bumps unread and last message on an incoming DM", () => {
    applyRealtimeMessageToSidebar(event("dm-1", SENDER), USER, TOKEN);
    const entry = sidebarDms().find((d) => d.id === "dm-1");
    expect(entry?.unread).toBe(1);
    expect(entry?.lastMessage).toBe("hello there");
  });

  it("does not bump unread for the conversation being viewed", () => {
    useChatStore.setState({
      activeConversation: { kind: "dm", id: "dm-1" },
    });
    applyRealtimeMessageToSidebar(event("dm-1", SENDER), USER, TOKEN);
    expect(sidebarDms().find((d) => d.id === "dm-1")?.unread).toBe(0);
  });

  it("does not bump unread for the sender's own message", () => {
    applyRealtimeMessageToSidebar(event("dm-1", USER), USER, TOKEN);
    const entry = sidebarDms().find((d) => d.id === "dm-1");
    expect(entry?.unread).toBe(0);
    expect(entry?.lastMessage).toBe("hello there");
  });

  it("adds a DM from someone new using the server's unread count", async () => {
    fetchDm.mockResolvedValue(dm("dm-new", 1));
    applyRealtimeMessageToSidebar(event("dm-new", SENDER), USER, TOKEN);
    await vi.waitFor(() =>
      expect(sidebarDms().some((d) => d.id === "dm-new")).toBe(true)
    );
    const entry = sidebarDms().find((d) => d.id === "dm-new");
    // Server count already includes this message - it must not be doubled.
    expect(entry?.unread).toBe(1);
    expect(entry?.lastMessage).toBe("hello there");
  });
});
