// @vitest-environment jsdom
//
// emojifyElement mutates a real DOM subtree - the rest of this repo's tests
// default to the lighter "node" environment (see vitest.config.ts), so this
// file opts into jsdom on its own.
import { describe, expect, it } from "vitest";
import {
  appleEmojiImageUrl,
  emojifyElement,
  emojiToUnified,
  EMOJI_IMAGE_DATA_ATTR,
  findEmojis,
} from "./apple-emoji";

describe("emojiToUnified", () => {
  it("converts a simple single-codepoint emoji", () => {
    expect(emojiToUnified("😀")).toBe("1f600");
  });

  it("drops a standalone variation selector-16", () => {
    // U+2764 U+FE0F ("heavy black heart" + VS16) -> emoji-datasource keys
    // this image as just "2764", not "2764-fe0f".
    expect(emojiToUnified("❤️")).toBe("2764");
  });

  it("keeps codepoints (including VS16) inside a ZWJ sequence", () => {
    // Family emoji: man + ZWJ + woman + ZWJ + girl + ZWJ + boy
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}";
    expect(emojiToUnified(family)).toBe("1f468-200d-1f469-200d-1f467-200d-1f466");
  });
});

describe("appleEmojiImageUrl", () => {
  it("builds a jsdelivr emoji-datasource-apple URL from the unified codepoint", () => {
    expect(appleEmojiImageUrl("😀")).toBe(
      "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f600.png"
    );
  });
});

describe("findEmojis", () => {
  it("returns each distinct emoji once, in order of first appearance", () => {
    expect(findEmojis("great 👍 job 👍 team 🎉")).toEqual(["👍", "🎉"]);
  });

  it("returns an empty array for text with no emoji", () => {
    expect(findEmojis("just plain text")).toEqual([]);
  });
});

describe("emojifyElement", () => {
  it("swaps a text-node emoji for an atomic Apple-style <img>", () => {
    const div = document.createElement("div");
    div.textContent = "nice work 🎉";
    emojifyElement(div);

    const img = div.querySelector(`[${EMOJI_IMAGE_DATA_ATTR}]`);
    expect(img).not.toBeNull();
    expect(img?.getAttribute(EMOJI_IMAGE_DATA_ATTR)).toBe("🎉");
    expect(div.textContent).toBe("nice work ");
  });

  it("does not touch emoji inside <a> or <button> (link hrefs, button labels)", () => {
    const div = document.createElement("div");
    div.innerHTML = '<a href="https://example.com">🎉 link</a>';
    emojifyElement(div);

    expect(div.querySelector(`[${EMOJI_IMAGE_DATA_ATTR}]`)).toBeNull();
    expect(div.querySelector("a")?.textContent).toBe("🎉 link");
  });

  it("does not re-process an emoji already swapped for an image", () => {
    const div = document.createElement("div");
    div.textContent = "🔥";
    emojifyElement(div);
    const firstPassCount = div.querySelectorAll(`[${EMOJI_IMAGE_DATA_ATTR}]`).length;

    emojifyElement(div);
    const secondPassCount = div.querySelectorAll(`[${EMOJI_IMAGE_DATA_ATTR}]`).length;

    expect(firstPassCount).toBe(1);
    expect(secondPassCount).toBe(1);
  });
});
