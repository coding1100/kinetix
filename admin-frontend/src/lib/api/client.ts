/** Same-origin path in dev (proxied by Next.js); absolute URL also supported. */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

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
  init?: RequestInit & { token?: string }
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
    throw parseApiError(res, data);
  }

  return data as T;
}

export { API_BASE };
