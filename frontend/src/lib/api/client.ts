/** Same-origin path in dev (proxied by Next.js); absolute URL also supported. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const GET_RETRY_ATTEMPTS = 3;
const GET_RETRY_DELAY_MS = 500;

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

function shouldRetryGet(method: string, attempt: number, err: unknown) {
  if (method !== "GET" || attempt >= GET_RETRY_ATTEMPTS - 1) return false;
  if (err instanceof ApiError) {
    return err.status === 503 || err.status === 502 || err.status === 504;
  }
  return err instanceof TypeError;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string }
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const method = (init?.method ?? "GET").toUpperCase();
  let lastError: unknown;

  for (let attempt = 0; attempt < GET_RETRY_ATTEMPTS; attempt++) {
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
        if (shouldRetryGet(method, attempt, apiError)) {
          lastError = apiError;
          await sleep(GET_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw apiError;
      }

      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(
          504,
          "TIMEOUT",
          "Request timed out — API or database may be slow"
        );
      }
      if (err instanceof TypeError) {
        throw new ApiError(
          0,
          "NETWORK_ERROR",
          err.message || "Network error — could not reach API"
        );
      }
      lastError = err;
      if (shouldRetryGet(method, attempt, err)) {
        await sleep(GET_RETRY_DELAY_MS * (attempt + 1));
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
