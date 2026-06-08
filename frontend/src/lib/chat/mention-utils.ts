import type {
  ComposerMentionSegment,
  ComposerSegment,
  MentionSelection,
} from "@/lib/chat/mention-types";

/** Up to two words after @ (first + last name). */
export const MENTION_BODY_RE = /(@[\w]+(?:\s+[\w]+)?)/g;

/** Channel mention token e.g. #general */
export const CHANNEL_BODY_RE = /(#[\w-]+)/g;

export const MESSAGE_TOKEN_RE =
  /(@[\w]+(?:\s+[\w]+)?|#[\w-]+)/g;

export function formatPersonMention(label: string) {
  return `@${label.trim()} `;
}

export function formatChannelMention(label: string) {
  const name = label.replace(/^#/, "").trim();
  return `#${name} `;
}

export function serializeComposerBody(
  segments: ComposerSegment[],
  draft: string
): string {
  const parts = segments.map((seg) => {
    if (seg.type === "text") return seg.value;
    if (seg.mentionType === "person") return formatPersonMention(seg.label);
    return formatChannelMention(seg.label);
  });
  return `${parts.join("")}${draft}`;
}

export function mentionSelectionToSegment(
  selection: MentionSelection
): ComposerMentionSegment {
  return {
    type: "mention",
    mentionType: selection.mentionType,
    id: selection.id,
    label: selection.label,
  };
}

/** Trailing @query in draft input, if user is typing a mention. */
export function getDraftMentionQuery(draft: string): string | null {
  const match = draft.match(/@([\w\s]*)$/);
  if (!match) return null;
  return match[1];
}

export function stripDraftMentionQuery(draft: string): string {
  return draft.replace(/@[\w\s]*$/, "");
}

export function filterMentionMembers<
  T extends { fullName: string; email: string },
>(members: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
  );
}

export function filterMentionChannels<
  T extends { name: string },
>(channels: T[], query: string): T[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return channels;
  return channels.filter((c) => c.name.toLowerCase().includes(q));
}
