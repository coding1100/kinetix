/** Same-origin path in dev (proxied by Next.js); absolute URL also supported. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const REQUEST_RETRY_ATTEMPTS = 3;
const GET_RETRY_DELAY_MS = 500;
const TRANSIENT_RETRY_DELAYS_MS = [300, 800];

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

/** Human-readable error for toasts and logs. */
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fired synchronously whenever any apiFetch call gets a 401 that couldn't be
// resolved by a silent token refresh — from anywhere in the app, not just
// the initial-load session bootstrap. Lets AuthProvider force an immediate
// logout on a non-recoverable code (account disabled, or refresh token also
// expired/invalid) without waiting for the next hard refresh.
type UnauthorizedHandler = (code: string) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

let refreshPromise: Promise<string | null> | null = null;
let refreshChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    refreshChannel = new BroadcastChannel("kinetix_auth_refresh");
    refreshChannel.onmessage = (event) => {
      if (event.data?.type === "REFRESH_SUCCESS" && event.data?.token) {
        import("@/stores/auth-store").then(({ useAuthStore }) => {
          const store = useAuthStore.getState();
          if (store.user) {
            store.updateSession({
              accessToken: event.data.token,
              user: store.user,
              workspaces: store.workspaces,
            });
          }
        });
      }
    };
  } catch {
    // Ignore channel creation errors
  }
}

/**
 * Silently exchanges the stored refresh token for a new access token and
 * updates the auth store. Dynamic imports avoid a static circular import
 * (auth.ts's refreshSession() itself calls apiFetch()).
 */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const [{ useAuthStore }, { refreshSession }] = await Promise.all([
          import("@/stores/auth-store"),
          import("./auth"),
        ]);
        const store = useAuthStore.getState();
        const refreshed = await refreshSession();
        store.updateSession({
          accessToken: refreshed.accessToken,
          user: refreshed.user,
          workspaces: store.workspaces,
        });
        if (refreshChannel) {
          try {
            refreshChannel.postMessage({
              type: "REFRESH_SUCCESS",
              token: refreshed.accessToken,
            });
          } catch {
            // Ignore channel post errors
          }
        }
        return refreshed.accessToken;
      } catch (err) {
        // Refresh token itself is missing/expired/invalid — nothing left to
        // retry with, caller falls back to the unauthorized handler.
        const code = err instanceof ApiError ? err.code : "INVALID_REFRESH";
        unauthorizedHandler?.(code);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
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

function retryDelayMs(method: string, attempt: number) {
  if (method === "GET") {
    return GET_RETRY_DELAY_MS * (attempt + 1);
  }
  return TRANSIENT_RETRY_DELAYS_MS[
    Math.min(attempt, TRANSIENT_RETRY_DELAYS_MS.length - 1)
  ];
}

function shouldRetryRequest(method: string, attempt: number, err: unknown) {
  if (attempt >= REQUEST_RETRY_ATTEMPTS - 1) return false;
  if (err instanceof ApiError) {
    if (err.code === "DATABASE_UNAVAILABLE" || err.status === 503) {
      return true;
    }
    if (method === "GET") {
      return err.status === 502 || err.status === 504;
    }
    return false;
  }
  return method === "GET" && err instanceof TypeError;
}

export function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string }
): Promise<T> {
  return apiFetchInternal<T>(path, init, false);
}

async function apiFetchInternal<T>(
  path: string,
  init: (RequestInit & { token?: string }) | undefined,
  isRetryAfterRefresh: boolean
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // Fallback to active access token in Zustand store if init.token is omitted
  let activeToken: string | undefined = init?.token;
  if (!activeToken && typeof window !== "undefined" && path !== "/auth/refresh") {
    try {
      const { useAuthStore } = await import("@/stores/auth-store");
      activeToken = useAuthStore.getState().accessToken ?? undefined;
    } catch {
      // Ignore dynamic import error
    }
  }

  if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

  const method = (init?.method ?? "GET").toUpperCase();
  let lastError: unknown;

  for (let attempt = 0; attempt < REQUEST_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!res.ok) {
        const apiError = parseApiError(res, data);
        if (apiError.status === 401) {
          // Access token expired mid-session: refresh it once, silently,
          // and replay this exact request — user never sees the error.
          const canRefreshAndRetry =
            !isRetryAfterRefresh &&
            Boolean(activeToken) &&
            apiError.code === "UNAUTHORIZED" &&
            path !== "/auth/refresh";
          if (canRefreshAndRetry) {
            const newToken = await refreshAccessToken();
            if (newToken) {
              return apiFetchInternal<T>(
                path,
                { ...init, token: newToken },
                true
              );
            }
            // refreshAccessToken() already fired unauthorizedHandler.
            throw apiError;
          }
          unauthorizedHandler?.(apiError.code);
        }
        if (shouldRetryRequest(method, attempt, apiError)) {
          lastError = apiError;
          await sleep(retryDelayMs(method, attempt));
          continue;
        }
        throw apiError;
      }

      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      if (err instanceof TypeError) {
        throw new ApiError(
          0,
          "NETWORK_ERROR",
          err.message || "Network error — could not reach API"
        );
      }
      lastError = err;
      if (shouldRetryRequest(method, attempt, err)) {
        await sleep(retryDelayMs(method, attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiError(503, "NETWORK_ERROR", "Request failed");
}

export { API_BASE };
