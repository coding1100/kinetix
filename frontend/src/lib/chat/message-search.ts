import { stripMessageHtml } from "@/lib/chat/rich-text/sanitize";

/** Plain-text preview for search snippets and sidebar previews. */
export function plainMessageBody(text: string): string {
  return stripMessageHtml(text);
}

export function highlightSearchSnippet(
  text: string,
  query: string,
  maxLength = 140
): { before: string; match: string; after: string } | null {
  const plain = plainMessageBody(text);
  const q = query.trim();
  if (!q) return null;

  const lower = plain.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return null;

  const start = Math.max(0, idx - 24);
  const end = Math.min(plain.length, idx + q.length + 56);
  const slice = plain.slice(start, end);
  const rel = idx - start;
  const before = `${start > 0 ? "…" : ""}${slice.slice(0, rel)}`;
  const match = slice.slice(rel, rel + q.length);
  const after = `${slice.slice(rel + q.length)}${end < plain.length ? "…" : ""}`;

  if (before.length + match.length + after.length > maxLength) {
    const truncated = plain.slice(0, maxLength - 1) + "…";
    const tIdx = truncated.toLowerCase().indexOf(q.toLowerCase());
    if (tIdx >= 0) {
      return {
        before: truncated.slice(0, tIdx),
        match: truncated.slice(tIdx, tIdx + q.length),
        after: truncated.slice(tIdx + q.length),
      };
    }
    return { before: truncated, match: "", after: "" };
  }

  return { before, match, after };
}
