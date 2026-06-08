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
