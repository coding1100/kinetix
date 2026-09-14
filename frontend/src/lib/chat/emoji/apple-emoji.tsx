import type { ReactNode } from "react";
import emojiRegex from "emoji-regex";
import { AppleEmoji } from "@/components/chat/emoji/AppleEmoji";

// Same CDN the emoji picker itself renders from (emoji-picker-react's default
// getEmojiUrl/emojiUrlByUnified) - keeps the picker's Apple-style preview and
// every other place an emoji is displayed visually identical, regardless of
// the OS's own emoji font (which is what a raw Unicode character would
// otherwise fall back to).
const APPLE_EMOJI_CDN_BASE =
  "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/";

const VARIATION_SELECTOR_16 = 0xfe0f;

/** Unified codepoint string (e.g. "1f600", "1f469-1f3fb-200d-2764-fe0f") the
 * CDN keys its image filenames by, matching emoji-datasource's convention of
 * dropping the standalone VS16 (present in text but not in the dataset's
 * unified strings) while keeping it inside ZWJ sequences. */
export function emojiToUnified(emoji: string): string {
  const codepoints = Array.from(emoji).map((c) => c.codePointAt(0)!);
  const hasZwj = codepoints.includes(0x200d);
  const filtered = hasZwj
    ? codepoints
    : codepoints.filter((c) => c !== VARIATION_SELECTOR_16);
  return filtered.map((c) => c.toString(16)).join("-");
}

export function appleEmojiImageUrl(emoji: string): string {
  return `${APPLE_EMOJI_CDN_BASE}${emojiToUnified(emoji)}.png`;
}

/** Every distinct emoji grapheme cluster found in text, in order of first
 * appearance, deduped - callers walk this once instead of re-running the
 * (stateful, `g`-flagged) regex per use. */
export function findEmojis(text: string): string[] {
  const matches = text.match(emojiRegex());
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/** data-emoji-char marks an inserted image as an atomic emoji unit — read
 * back by rich-composer serialization (to restore the real Unicode
 * character before the message is sent/stored) and by the display-side
 * DOM walk (to skip text already swapped for an image, e.g. when a message
 * re-renders). Never sent to the backend and never touched by
 * sanitizeMessageHtml's ALLOWED_TAGS - these images live only transiently in
 * the DOM, not in persisted/sanitized message HTML. */
export const EMOJI_IMAGE_DATA_ATTR = "data-emoji-char";

export function createAppleEmojiImage(
  emoji: string,
  size = 16
): HTMLImageElement {
  const img = document.createElement("img");
  img.src = appleEmojiImageUrl(emoji);
  img.alt = emoji;
  img.width = size;
  img.height = size;
  img.setAttribute(EMOJI_IMAGE_DATA_ATTR, emoji);
  img.setAttribute("contenteditable", "false");
  img.draggable = false;
  // 1em (not a fixed px offset) so the nudge scales with whatever line-height
  // the emoji lands in (composer vs. sent-message text vs. reaction badges)
  // instead of only looking right at one specific font size and overlapping
  // adjacent lines everywhere else, as a fixed -4px did.
  img.style.display = "inline-block";
  img.style.verticalAlign = "-0.2em";
  return img;
}

/** Walk a DOM subtree's text nodes and swap every emoji grapheme cluster for
 * an atomic Apple-style <img> (createAppleEmojiImage), in place. Used both
 * for read-only message display and for loading a stored message's plain
 * Unicode emoji back into the composer as images when editing it - the two
 * places where emoji already exist as plain text in the DOM and need to
 * *become* images, as opposed to insertEmojiImageAtCursor which creates the
 * image directly at the moment an emoji is picked. Skips text inside <a>/
 * <button>/existing emoji images/script/style so link hrefs, button labels,
 * and already-swapped nodes are never walked into or duplicated. */
export function emojifyElement(root: HTMLElement, size = 16): void {
  const SKIP_TAGS = new Set(["A", "BUTTON", "SCRIPT", "STYLE", "IMG"]);
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let el = node.parentElement;
      while (el && el !== root) {
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.data;
    const matches = text.match(emojiRegex());
    if (!matches || matches.length === 0) continue;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    const re = emojiRegex();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }
      frag.appendChild(createAppleEmojiImage(m[0], size));
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

/** React-node counterpart to emojifyElement, for plain-React (non-
 * dangerouslySetInnerHTML) rendering paths like MessageBodyWithMentions'
 * non-HTML branch - splits text into an array of plain strings and
 * <AppleEmoji> elements instead of mutating already-rendered DOM, so it
 * composes safely with React's own reconciliation (mirrors linkifyText's
 * split-and-map shape in lib/text/linkify.tsx). */
export function emojifyText(text: string, keyPrefix = "", size = 16): ReactNode[] {
  const re = emojiRegex();
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(text.slice(lastIndex, m.index));
    }
    out.push(<AppleEmoji key={`${keyPrefix}emoji-${i++}`} emoji={m[0]} size={size} />);
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out;
}
