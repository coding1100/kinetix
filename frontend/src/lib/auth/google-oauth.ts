function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
}

/** App origin used for same-origin API calls (Next.js proxy in dev). */
export function appOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3001"
  );
}

/** Public API origin (Google OAuth callback must hit the real API host). */
export function apiOrigin() {
  const explicit = process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/$/, "");
  if (explicit) return explicit;
  const base = apiBase();
  if (base.startsWith("/")) {
    return "http://localhost:4001";
  }
  return base.replace(/\/api\/v1\/?$/, "");
}

export function googleOAuthStartUrl(nextPath: string) {
  const next = nextPath.startsWith("/") ? nextPath : "/home/inbox";
  // Same-origin via Next rewrite — avoids stale direct :4001 bookmarks
  return `${appOrigin()}/api/v1/auth/google/start?next=${encodeURIComponent(next)}`;
}
