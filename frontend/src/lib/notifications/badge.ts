"use client";

import { isTauri } from "@/lib/tauri";

const APP_NAME = "Kinetix";

/**
 * Synchronizes the total unread count with the OS taskbar/dock app icon badge,
 * Tauri desktop window badge, and the window title.
 *
 * When count > 0:
 *   - OS Taskbar / Dock Icon displays badge count (e.g. 1, 2, 5)
 *   - Document title becomes "(N) Kinetix"
 * When count === 0:
 *   - App Icon badge is cleared / removed automatically
 *   - Document title returns to "Kinetix"
 */
export function updateAppUnreadBadge(count: number): void {
  const doc = typeof document !== "undefined" ? document : (globalThis as any).document;
  const nav = typeof navigator !== "undefined" ? navigator : (globalThis as any).navigator;

  if (!doc) return;

  const validCount = Math.max(0, Math.floor(count));

  // 1. Update Document Window Title
  try {
    const currentTitle = doc.title || APP_NAME;
    const strippedTitle = currentTitle.replace(/^\(\d+\)\s*/, "");

    if (validCount > 0) {
      doc.title = `(${validCount}) ${strippedTitle}`;
    } else {
      doc.title = strippedTitle;
    }
  } catch (err) {
    console.warn("[badge] failed to update document title", err);
  }

  // 2. Web Badging API (Windows Taskbar / macOS Dock App Icon / PWA)
  if (nav) {
    const badgingNav = nav as Navigator & {
      setAppBadge?: (count: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (validCount > 0 && typeof badgingNav.setAppBadge === "function") {
      badgingNav.setAppBadge(validCount).catch(() => {});
    } else if (validCount === 0 && typeof badgingNav.clearAppBadge === "function") {
      badgingNav.clearAppBadge().catch(() => {});
    }
  }

  // 3. Tauri v2 Desktop App Badge API
  if (isTauri()) {
    try {
      import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) => {
          const appWindow = getCurrentWindow();
          if ("setBadgeCount" in appWindow && typeof (appWindow as any).setBadgeCount === "function") {
            (appWindow as any)
              .setBadgeCount(validCount > 0 ? validCount : undefined)
              .catch(() => {});
          }
        })
        .catch(() => {});
    } catch {
      // Fallback handled by setAppBadge and window title
    }
  }
}
