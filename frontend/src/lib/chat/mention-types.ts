export type MentionSelection = {
  mentionType: "person" | "channel";
  id: string;
  label: string;
};

export type ComposerMentionSegment = {
  type: "mention";
  mentionType: "person" | "channel";
  id: string;
  label: string;
};

export type ComposerTextSegment = {
  type: "text";
  value: string;
};

export type ComposerSegment = ComposerTextSegment | ComposerMentionSegment;
