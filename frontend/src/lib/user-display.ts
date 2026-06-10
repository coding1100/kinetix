/** Shared avatar fallback palette — use {@link avatarColorClassForKey} everywhere. */
export const AVATAR_FALLBACK_COLOR_CLASSES = [
  "bg-violet-600 text-white",
  "bg-sky-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-slate-700 text-white",
] as const;

function hashDisplayKey(key: string): number {
  return [...key].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
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
