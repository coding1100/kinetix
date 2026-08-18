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

