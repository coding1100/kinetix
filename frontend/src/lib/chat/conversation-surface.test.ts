import { describe, expect, it } from "vitest";
import { channelPathForSurface, isHomeSurface } from "./conversation-surface";

describe("channelPathForSurface", () => {
  it("keeps a channel created from Home inside Home", () => {
    expect(channelPathForSurface("/home/inbox", "ch-1")).toBe("/home/c/ch-1");
    expect(channelPathForSurface("/home", "ch-1")).toBe("/home/c/ch-1");
    expect(channelPathForSurface("/home/c/ch-0", "ch-1")).toBe("/home/c/ch-1");
  });

  it("sends a channel created anywhere else to Chat", () => {
    expect(channelPathForSurface("/chat", "ch-1")).toBe("/chat/c/ch-1");
    expect(channelPathForSurface("/people", "ch-1")).toBe("/chat/c/ch-1");
    expect(channelPathForSurface(null, "ch-1")).toBe("/chat/c/ch-1");
  });

  it("does not treat a path that merely starts with home as Home", () => {
    expect(isHomeSurface("/homework")).toBe(false);
    expect(channelPathForSurface("/homework", "ch-1")).toBe("/chat/c/ch-1");
  });
});
