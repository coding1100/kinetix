// @vitest-environment jsdom
//
// createAppleEmojiImage (like extractMentionChips' own DOM parsing below it
// in serialize.ts) needs a real `document` - the rest of this repo's tests
// default to the lighter "node" environment (see vitest.config.ts), so this
// file opts into jsdom on its own rather than widening the global default.
import { describe, expect, it } from "vitest";
import { createAppleEmojiImage } from "@/lib/chat/emoji/apple-emoji";
import { serializeRichComposerBody } from "./serialize";

describe("serializeRichComposerBody - emoji images", () => {
  it("restores the plain Unicode character for an emoji picked via the picker", () => {
    const img = createAppleEmojiImage("😀");
    const html = `Great job ${img.outerHTML}!`;
    expect(serializeRichComposerBody([], html)).toBe("Great job 😀!");
  });

  it("restores multiple distinct emoji images in order", () => {
    const thumbsUp = createAppleEmojiImage("👍").outerHTML;
    const party = createAppleEmojiImage("🎉").outerHTML;
    const html = `${thumbsUp} nice ${party}`;
    expect(serializeRichComposerBody([], html)).toBe("👍 nice 🎉");
  });

  it("never leaves an <img> tag in the serialized body sent to the backend", () => {
    const img = createAppleEmojiImage("🔥");
    const html = `on fire ${img.outerHTML}`;
    const result = serializeRichComposerBody([], html);
    expect(result).not.toContain("<img");
    expect(result).toBe("on fire 🔥");
  });

  it("leaves plain text with no emoji images untouched", () => {
    expect(serializeRichComposerBody([], "just plain text")).toBe("just plain text");
  });
});
