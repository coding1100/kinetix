function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
}

/** App origin (Next.js) — used for post-login redirects in the UI. */
export function appOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/** Public API origin (Google OAuth must start and callback on this host). */
export function apiOrigin() {
  const base = apiBase();
  // Same-origin /api/v1 (nginx or Next proxy): use current site in the browser.
  if (typeof window !== "undefined" && base.startsWith("/")) {
    return window.location.origin;
  }
  const explicit = process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (base.startsWith("/")) {
    return "http://localhost:4000";
  }
  return base.replace(/\/api\/v1\/?$/, "");
}

export function googleOAuthStartUrl(nextPath: string) {
  const next = nextPath.startsWith("/") ? nextPath : "/home/inbox";
  // Hit the API directly so the browser receives Google's 302 (Next proxy used to follow it).
  return `${apiOrigin()}/api/v1/auth/google/start?next=${encodeURIComponent(next)}`;
}
