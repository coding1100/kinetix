"use client";

import { isTauri } from "@/lib/tauri";

const OPENABLE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const EXPLICIT_EXTERNAL_SCHEME_RE = /^(?:https?:\/\/|mailto:)/i;

export function normalizeExternalUrl(rawUrl: string): string {
  let value = rawUrl.trim();
  if (!value) return "";
  if (!EXPLICIT_EXTERNAL_SCHEME_RE.test(value)) {
    if (/^(?:www\.|[a-z0-9-]+(?:\.[a-z0-9-]+)+)/i.test(value)) {
      value = `https://${value}`;
    }
  }
  return value;
}

export function isOpenableExternalUrl(rawUrl: string): boolean {
  const value = normalizeExternalUrl(rawUrl);
  if (!value || !EXPLICIT_EXTERNAL_SCHEME_RE.test(value)) return false;

  try {
    const parsed = new URL(value);
    return OPENABLE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function isExternalHref(href: string): boolean {
  const normalized = normalizeExternalUrl(href);
  if (!isOpenableExternalUrl(normalized)) return false;
  if (typeof window === "undefined") return true;

  try {
    const targetUrl = new URL(normalized, window.location.href);
    return targetUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export async function openExternalUrl(rawUrl: string): Promise<void> {
  const normalized = normalizeExternalUrl(rawUrl);
  if (
    !normalized ||
    typeof window === "undefined" ||
    !isOpenableExternalUrl(normalized)
  ) {
    return;
  }

  const win = window as any;

  // Pre-create synchronous window during the user gesture to prevent popup blocking in WebViews
  let syncTab: Window | null = null;
  try {
    syncTab = window.open("about:blank", "_blank");
    if (syncTab) syncTab.opener = null;
  } catch {
    syncTab = null;
  }

  const closeSyncTab = () => {
    if (syncTab && !syncTab.closed) {
      try {
        syncTab.close();
      } catch {
        // ignore
      }
    }
  };

  // 1. Tauri v2 Plugin Shell
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(normalized);
      closeSyncTab();
      return;
    } catch (err) {
      console.warn("[links] failed to open via tauri plugin-shell", err);
    }

    try {
      if (win.__TAURI_INTERNALS__?.invoke) {
        await win.__TAURI_INTERNALS__.invoke("plugin:shell|open", {
          href: normalized,
        });
        closeSyncTab();
        return;
      }
    } catch (err) {
      console.warn("[links] failed to open via tauri invoke", err);
    }

    try {
      if (win.__TAURI__?.shell?.open) {
        await win.__TAURI__.shell.open(normalized);
        closeSyncTab();
        return;
      }
    } catch (err) {
      console.warn("[links] failed to open via tauri window.shell", err);
    }
  }

  // 2. Electron Desktop Shell
  if (win.electron?.openExternal) {
    try {
      await win.electron.openExternal(normalized);
      closeSyncTab();
      return;
    } catch (err) {
      console.warn("[links] failed to open via electron api", err);
    }
  }

  if (win.ipcRenderer?.send) {
    try {
      win.ipcRenderer.send("open-external", normalized);
      closeSyncTab();
      return;
    } catch (err) {
      console.warn("[links] failed to open via ipcRenderer", err);
    }
  }

  // 3. Fallback for WebViews & older .exe binaries:
  if (syncTab && !syncTab.closed) {
    try {
      syncTab.location.href = normalized;
      return;
    } catch {
      // fallback
    }
  }

  try {
    const tab = window.open(normalized, "_blank");
    if (tab) {
      try {
        tab.opener = null;
      } catch {
        // ignore
      }
      return;
    }
  } catch {
    // window.open blocked
  }

  try {
    const a = document.createElement("a");
    a.href = normalized;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error("[links] failed all open attempts for", normalized, err);
  }
}



