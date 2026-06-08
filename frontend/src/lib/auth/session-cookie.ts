const SESSION_COOKIE = "riseup_session";
const MAX_AGE = 7 * 24 * 60 * 60;

export function setSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export { SESSION_COOKIE };
