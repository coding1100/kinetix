import type { ComposerSegment } from "@/lib/chat/mention-types";
import {
  formatChannelMention,
  formatPersonMention,
} from "@/lib/chat/mention-utils";
import {
  messageBodyHasHtml,
  normalizeComposerHtml,
} from "@/lib/chat/rich-text/sanitize";
import { EMOJI_IMAGE_DATA_ATTR } from "@/lib/chat/emoji/apple-emoji";

// Wrapped in \x01 control chars, written here as the escape sequence so the
// source file stays plain ASCII - not typeable, so this can't collide with
// real message content.
const MENTION_MARKER_RE = /\x01MENTION(\d+)\x01/g;
const EMOJI_MARKER_RE = /\x01EMOJI(\d+)\x01/g;

/** Emoji picked in the composer are inserted as atomic Apple-style <img>
 * nodes (see insertEmojiImageAtCursor) purely for display while typing -
 * sanitizeMessageHtml's ALLOWED_TAGS deliberately excludes <img> (an open
 * XSS vector for arbitrary pasted markup), so these must never reach it.
 * Swap each one for a marker before normalizeComposerHtml/sanitization run,
 * then restore the real Unicode emoji character afterward - same
 * marker-and-restore lifecycle as extractMentionChips below. */
function extractEmojiImages(html: string): { html: string; emojis: string[] } {
  const emojis: string[] = [];
  if (!html || typeof document === "undefined" || !html.includes(EMOJI_IMAGE_DATA_ATTR)) {
    return { html, emojis };
  }

  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll<HTMLElement>(`[${EMOJI_IMAGE_DATA_ATTR}]`).forEach((img) => {
    const index = emojis.length;
    emojis.push(img.getAttribute(EMOJI_IMAGE_DATA_ATTR) ?? "");
    img.replaceWith(document.createTextNode(`\x01EMOJI${index}\x01`));
  });
  return { html: div.innerHTML, emojis };
}

function restoreEmojiTokens(text: string, emojis: string[]): string {
  if (emojis.length === 0) return text;
  return text.replace(
    EMOJI_MARKER_RE,
    (_match, index: string) => emojis[Number(index)] ?? ""
  );
}

/** Mention chips carry a non-breaking space joining a two-word name into
 * one @token, but normalizeComposerHtml's entity-decoding (needed for the
 * rest of the message) strips ALL nbsp/&nbsp;, chip or not. Swap each chip
 * for a marker before that runs, then swap the real token back in
 * afterward so its nbsp survives untouched. */
function extractMentionChips(html: string): { html: string; tokens: string[] } {
  const tokens: string[] = [];
  if (!html || typeof document === "undefined" || !html.includes("data-mention-type")) {
    return { html, tokens };
  }

  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll<HTMLElement>("[data-mention-type]").forEach((chip) => {
    const label = chip.dataset.mentionLabel ?? chip.textContent ?? "";
    const token =
      chip.dataset.mentionType === "channel"
        ? formatChannelMention(label)
        : formatPersonMention(label);
    const index = tokens.length;
    tokens.push(token.trimEnd());
    chip.replaceWith(document.createTextNode(`\x01MENTION${index}\x01`));
  });
  return { html: div.innerHTML, tokens };
}

function restoreMentionTokens(text: string, tokens: string[]): string {
  if (tokens.length === 0) return text;
  return text.replace(
    MENTION_MARKER_RE,
    (match: string, index: string, offset: number, whole: string) => {
      const token = tokens[Number(index)] ?? "";
      // If the very next character is a word char (the trailing space that
      // should separate the chip from the following word got collapsed in
      // the contenteditable), re-insert one. Without it, MESSAGE_TOKEN_RE
      // greedily eats the following word into the mention token, e.g.
      // "@Super Adminthis" highlights as one mention in the sent message.
      const after = whole[offset + match.length];
      return after && /\w/.test(after) ? `${token} ` : token;
    }
  );
}

export function serializeRichComposerBody(
  segments: ComposerSegment[],
  draftHtml: string
): string {
  const prefix = segments
    .map((seg) => {
      if (seg.type === "text") return seg.value;
      if (seg.mentionType === "person") return formatPersonMention(seg.label);
      return formatChannelMention(seg.label);
    })
    .join("");

  const { html: htmlWithoutChips, tokens } = extractMentionChips(draftHtml);
  const { html: htmlWithPlaceholders, emojis } = extractEmojiImages(htmlWithoutChips);
  const html = restoreEmojiTokens(
    restoreMentionTokens(normalizeComposerHtml(htmlWithPlaceholders), tokens),
    emojis
  );
  const combined = `${prefix}${html}`.trim();
  if (!combined) return "";

  if (!html) return prefix.trim();
  if (!messageBodyHasHtml(combined) && !prefix) return html.trim();
  return combined;
}
