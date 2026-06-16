const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api/v1";

function normalizeBasePath(pathname: string): string {
  if (!pathname || pathname === "/") return "";
  return pathname.replace(/\/+$/, "");
}

export function getSocketConnectionConfig(): { url?: string; path: string } {
  const raw =
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    API_BASE.replace(/\/api\/v1\/?$/, "");

  try {
    const parsed = new URL(raw);
    const basePath = normalizeBasePath(parsed.pathname);
    const path = `${basePath || ""}/socket.io`;
    return {
      url: `${parsed.protocol}//${parsed.host}`,
      path,
    };
  } catch {
    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    const basePath = normalizeBasePath(withLeadingSlash);
    return { path: `${basePath || ""}/socket.io` };
  }
}
