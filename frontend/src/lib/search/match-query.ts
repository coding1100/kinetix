/** True when `query` is empty or any haystack contains the query (case-insensitive). */
export function matchesQuery(
  query: string,
  ...haystacks: (string | null | undefined)[]
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystacks.some((h) => h?.toLowerCase().includes(q));
}
