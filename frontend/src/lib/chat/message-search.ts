export function highlightSearchSnippet(
  text: string,
  query: string,
  maxLength = 140
): { before: string; match: string; after: string } | null {
  const q = query.trim();
  if (!q) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return null;

  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + q.length + 56);
  const slice = text.slice(start, end);
  const rel = idx - start;
  const before = `${start > 0 ? "…" : ""}${slice.slice(0, rel)}`;
  const match = slice.slice(rel, rel + q.length);
  const after = `${slice.slice(rel + q.length)}${end < text.length ? "…" : ""}`;
  if (before.length + match.length + after.length > maxLength) {
    return { before: text.slice(0, maxLength - 1) + "…", match: "", after: "" };
  }
  return { before, match, after };
}
