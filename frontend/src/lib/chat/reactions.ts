export type ReactionCount = { emoji: string; count: number };

/** Immediate UI toggle; reconciled when the API/socket response arrives. */
export function optimisticToggleReaction(
  reactions: ReactionCount[],
  emoji: string
): ReactionCount[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (existing) {
    if (existing.count <= 1) {
      return reactions.filter((r) => r.emoji !== emoji);
    }
    return reactions.map((r) =>
      r.emoji === emoji ? { ...r, count: r.count - 1 } : r
    );
  }
  return [...reactions, { emoji, count: 1 }];
}
