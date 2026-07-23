/** Shared avatar fallback palette — use {@link avatarColorClassForKey} everywhere.
 * Muted/pastel tones (soft tint background, deeper matching text) rather than
 * bright saturated fills, kept large and visually distinct so that different
 * people are unlikely to land on the same color (a small palette with a weak
 * hash made unrelated users collide often enough to look identical). */
export const AVATAR_FALLBACK_COLOR_CLASSES = [
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300",
  "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
] as const;

/** FNV-1a — a plain char-code sum put permutations of the same characters
 * (e.g. two UUIDs sharing digits in different positions) in the same bucket
 * far too often; this spreads keys evenly across the palette instead. */
function hashDisplayKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Stable avatar colors from user id (preferred) or display name. */
export function avatarColorClassForKey(
  key?: string | null,
  fallbackName?: string | null
): string {
  const source = key?.trim() || fallbackName?.trim() || "user";
  return AVATAR_FALLBACK_COLOR_CLASSES[
    hashDisplayKey(source) % AVATAR_FALLBACK_COLOR_CLASSES.length
  ];
}

function firstInitialLetter(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "U";
  const firstToken = trimmed.split(/\s+/).filter(Boolean)[0] ?? trimmed;
  const letter = firstToken.charAt(0);
  return letter ? letter.toUpperCase() : "U";
}

/** Single capital letter for avatar fallbacks from a display name. */
export function avatarInitialFromName(name: string): string {
  return firstInitialLetter(name);
}

/** Single capital letter when no profile image (name and/or email). */
export function avatarInitial(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmed = fullName?.trim();
  if (trimmed) return firstInitialLetter(trimmed);
  const mail = email?.trim();
  if (mail) return mail.charAt(0).toUpperCase();
  return "U";
}
