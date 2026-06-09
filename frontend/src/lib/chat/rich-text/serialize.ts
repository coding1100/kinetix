import type { ComposerSegment } from "@/lib/chat/mention-types";
import {
  formatChannelMention,
  formatPersonMention,
} from "@/lib/chat/mention-utils";
import {
  messageBodyHasHtml,
  normalizeComposerHtml,
} from "@/lib/chat/rich-text/sanitize";

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

  const html = normalizeComposerHtml(draftHtml);
  const combined = `${prefix}${html}`.trim();
  if (!combined) return "";

  if (!html) return prefix.trim();
  if (!messageBodyHasHtml(combined) && !prefix) return html.trim();
  return combined;
}
