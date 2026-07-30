import { getAppBasePath } from "@/lib/utils";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api/v1";

function normalizeBasePath(pathname: string): string {
  if (!pathname || pathname === "/") return "";
  return pathname.replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function resolveBasePathFromApi(apiBase: string): string {
  if (isAbsoluteHttpUrl(apiBase)) return "";
  const stripped = apiBase.replace(/\/api\/v1\/?$/, "");
  if (!stripped || stripped === "/") return "";
  return normalizeBasePath(stripped.startsWith("/") ? stripped : `/${stripped}`);
}

function resolveSocketBasePath(): string {
  return getAppBasePath() || resolveBasePathFromApi(API_BASE.trim());
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

function shouldUseBrowserOrigin(envUrl: string | undefined): boolean {
  if (typeof window === "undefined") return false;
  if (!envUrl || envUrl.startsWith("/")) return true;
  if (!isAbsoluteHttpUrl(envUrl)) return true;

  try {
    const parsed = new URL(envUrl);
    // A loopback socket URL is only wrong when the page itself is not on
    // loopback (a deployed host with a leftover localhost env value). Browsing
    // 127.0.0.1 while the env says localhost is the same machine, so keep the
    // configured URL - falling back to the page origin there would point the
    // socket at the Next dev server, which serves no socket.io endpoint.
    if (isLoopbackHost(parsed.hostname)) {
      return !isLoopbackHost(window.location.hostname);
    }
  } catch {
    return true;
  }

  return false;
}

export function getSocketConnectionConfig(): { url: string; path: string } {
  const basePath = resolveSocketBasePath();
  const path = `${basePath}/socket.io`;

  const envSocket = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  const envApiOrigin = API_BASE.replace(/\/api\/v1\/?$/, "").trim();
  const raw = envSocket || envApiOrigin;

  if (
    typeof window !== "undefined" &&
    (shouldUseBrowserOrigin(envSocket) || shouldUseBrowserOrigin(raw))
  ) {
    return { url: window.location.origin, path };
  }

  if (isAbsoluteHttpUrl(raw)) {
    try {
      const parsed = new URL(raw);
      const socketBase = normalizeBasePath(parsed.pathname) || basePath;
      return {
        url: `${parsed.protocol}//${parsed.host}`,
        path: `${socketBase}/socket.io`,
      };
    } catch {
      // fall through
    }
  }

  if (typeof window !== "undefined") {
    return { url: window.location.origin, path };
  }

  const fallbackUrl = isAbsoluteHttpUrl(raw)
    ? `${new URL(raw).protocol}//${new URL(raw).host}`
    : "http://localhost:4001";

  return { url: fallbackUrl, path };
}
