import { describe, expect, it } from "vitest";
import {
  getCachedChannelMembers,
  mergeChannelMembersIntoCache,
} from "./channel-members-cache";
import type { ChannelMember } from "@/lib/types/chat";

const ws = "ws-1";
const channel = "ch-1";

function member(id: string, name: string): ChannelMember {
  return {
    id,
    fullName: name,
    email: `${id}@demo.com`,
    isFollowing: false,
    starred: false,
    joinedAt: null,
    workspaceRole: "MEMBER",
  };
}

describe("mergeChannelMembersIntoCache", () => {
  it("merges new members into an empty cache", () => {
    mergeChannelMembersIntoCache(ws, channel, [member("u1", "Alex")]);
    expect(getCachedChannelMembers(ws, channel)?.map((m) => m.id)).toEqual([
      "u1",
    ]);
  });

  it("updates existing members without dropping others", () => {
    mergeChannelMembersIntoCache(ws, channel, [
      member("u1", "Alex"),
      member("u2", "Owner"),
    ]);
    expect(getCachedChannelMembers(ws, channel)?.map((m) => m.id).sort()).toEqual(
      ["u1", "u2"]
    );
  });
});
