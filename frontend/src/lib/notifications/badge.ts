"use client";

import { isTauri } from "@/lib/tauri";

const APP_NAME = "Kinetix";
let originalFaviconHref: string | null = null;

function updateFaviconBadge(doc: Document, count: number): void {
  try {
    if (typeof doc.createElement !== "function") return;
    let favicon = doc.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!favicon) return;

    if (!originalFaviconHref) {
      originalFaviconHref = favicon.href;
    }

    if (count === 0) {
      if (originalFaviconHref) favicon.href = originalFaviconHref;
      return;
    }

    if (typeof Image === "undefined") return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = originalFaviconHref;
    img.onload = () => {
      try {
        const canvas = doc.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 32, 32);

        // Draw red badge circle on top right
        ctx.beginPath();
        ctx.arc(24, 8, 7.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ef4444";
        ctx.fill();

        // Draw white text count
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const text = count > 9 ? "9+" : String(count);
        ctx.fillText(text, 24, 8.5);

        favicon.href = canvas.toDataURL("image/png");
      } catch {
        // Fallback handled by title and badging API
      }
    };
  } catch {
    // Ignore errors in non-browser/test contexts
  }
}

/**
 * Synchronizes the total unread count with the OS taskbar/dock app icon badge,
 * Tauri desktop window badge, favicon red dot badge, and the window title.
 *
 * When count > 0:
 *   - OS Taskbar / Dock Icon displays badge count (e.g. 1, 2, 5)
 *   - Document title becomes "(N) Kinetix"
 *   - Favicon displays red notification count dot
 * When count === 0:
 *   - App Icon badge is cleared / removed automatically
 *   - Document title returns to "Kinetix"
 *   - Favicon restores original app icon
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

  // 2. Favicon Canvas Red Badge
  updateFaviconBadge(doc, validCount);

  // 3. Web Badging API (Windows Taskbar / macOS Dock App Icon / PWA)
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

  // 4. Tauri v2 Desktop App Badge API
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
      // Fallback handled by setAppBadge, favicon and window title
    }
  }
}
