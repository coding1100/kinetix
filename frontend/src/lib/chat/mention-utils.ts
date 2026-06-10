import type {
  ComposerMentionSegment,
  ComposerSegment,
  MentionSelection,
} from "@/lib/chat/mention-types";

/** Separates first/last name inside a picker mention (not a normal word space). */
export const MENTION_NAME_SEP = "\u00a0";

/**
 * @name or @first\u00a0last from the mention picker; channel #name.
 * Stops at normal whitespace so "@Husnain hey" only highlights @Husnain.
 */
export const MESSAGE_TOKEN_RE =
  /(@[\w]+(?:\u00a0[\w]+)?|@[\w]+&nbsp;[\w]+|#[\w-]+)(?=\s|$|[.,!?;:])/g;

export function formatPersonMention(label: string) {
  const normalized = label.trim().replace(/\s+/g, MENTION_NAME_SEP);
  return `@${normalized} `;
}

export function displayMentionToken(token: string) {
  return token.replace(/\u00a0/g, " ").replace(/&nbsp;/gi, " ");
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
  const at = draft.lastIndexOf("@");
  if (at < 0) return null;

  let query = draft.slice(at + 1);
  const newline = query.indexOf("\n");
  if (newline >= 0) {
    query = query.slice(0, newline);
  }

  if (query.includes("@") || query.includes("#")) return null;
  if (query.length > 0 && /[^\w\s.'-]/.test(query)) return null;

  return query;
}

export function stripDraftMentionQuery(draft: string): string {
  const at = draft.lastIndexOf("@");
  if (at < 0) return draft;

  let query = draft.slice(at + 1);
  const newline = query.indexOf("\n");
  if (newline >= 0) {
    query = query.slice(0, newline);
  }

  if (query.includes("@") || query.includes("#")) return draft;
  if (query.length > 0 && /[^\w\s.'-]/.test(query)) return draft;

  return draft.slice(0, at);
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
