import { useAdminAuthStore } from "@/stores/auth-store";
import type { AdminUser } from "@/lib/api/admin";

/** Same-origin path in dev (proxied by Next.js); absolute URL also supported. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

/** Paths that must never trigger refresh-on-401 (they ARE the auth flow). */
const AUTH_PATH_PREFIX = "/admin/auth/";

let refreshPromise: Promise<boolean> | null = null;

/** Raw fetch (bypasses apiFetch) so a failed refresh can't recurse into itself. */
async function doRefresh(): Promise<boolean> {
  const { setSession } = useAdminAuthStore.getState();
  try {
    const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as {
      accessToken?: string;
      user?: AdminUser;
    } | null;
    if (!data?.accessToken || !data.user) return false;
    setSession({
      accessToken: data.accessToken,
      user: data.user,
    });
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  useAdminAuthStore.getState().clearSession();
  if (typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?next=${next}`;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function formatRequestError(err: unknown): string {
  if (err instanceof ApiError) {
    const status = err.status > 0 ? `HTTP ${err.status}` : err.code;
    const detail = err.message?.trim() || err.code || "Request failed";
    return `${status}: ${detail}`;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }
  return "Request failed (unknown error)";
}

function parseApiError(
  res: Response,
  data: Record<string, unknown>
): ApiError {
  const err = data as {
    error?: { code?: string; message?: string };
    detail?: string | { msg?: string }[];
  };
  let message = err.error?.message;
  if (!message && typeof err.detail === "string") {
    message = err.detail;
  }
  if (!message && Array.isArray(err.detail) && err.detail[0]?.msg) {
    message = err.detail[0].msg;
  }
  return new ApiError(
    res.status,
    err.error?.code ?? "API_ERROR",
    message ?? res.statusText
  );
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
  _isRetry = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const isAuthCall = path.startsWith(AUTH_PATH_PREFIX);
    if (res.status === 401 && !isAuthCall && !_isRetry) {
      refreshPromise ??= doRefresh().finally(() => {
        refreshPromise = null;
      });
      const refreshed = await refreshPromise;
      if (refreshed) {
        const freshToken = useAdminAuthStore.getState().accessToken;
        return apiFetch<T>(path, { ...init, token: freshToken ?? undefined }, true);
      }
      redirectToLogin();
    }
    throw parseApiError(res, data);
  }

  return data as T;
}

export { API_BASE };
