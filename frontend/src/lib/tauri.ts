"use client";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window ||
      "__TAURI_IPC__" in window ||
      "__TAURI__" in window ||
      Boolean((window as any).__TAURI_METADATA__))
  );
}

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as any;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  return (
    isTauri() ||
    "electron" in win ||
    "ipcRenderer" in win ||
    Boolean(win.process?.versions?.electron) ||
    /tauri|electron|desktop/i.test(ua)
  );
}

/**
 * Best-effort target key matching the ones backend-py's /desktop/download
 * and /desktop/update endpoints expect - inferred from the UA/platform
 * since no OS-detection Tauri plugin is installed and adding one just for
 * this would be new surface area for a single lookup. Only needs to be
 * "close enough" to point a human at the right installer; it isn't used
 * for the update-signature verification path itself.
 */
export function desktopUpdateTarget(): string {
  if (typeof navigator === "undefined") return "windows-x86_64";
  const ua = navigator.userAgent || "";
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  const combined = `${ua} ${platform ?? ""}`.toLowerCase();

  if (combined.includes("mac")) {
    return /arm|apple silicon/.test(combined) ? "darwin-aarch64" : "darwin-x86_64";
  }
  if (combined.includes("linux")) {
    if (combined.includes("ubuntu") || combined.includes("debian")) return "linux-x86_64-deb";
    if (combined.includes("fedora") || combined.includes("red hat")) return "linux-x86_64-rpm";
    return "linux-x86_64";
  }
  return "windows-x86_64";
}

