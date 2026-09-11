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
        drawBadgeCircle(ctx, count, 24, 8, 7.5);

        favicon.href = canvas.toDataURL("image/png");
      } catch {
        // Fallback handled by title and badging API
      }
    };
  } catch {
    // Ignore errors in non-browser/test contexts
  }
}

/** Draws a red circle with a white count label - shared by the favicon badge and the Windows taskbar overlay icon. */
function drawBadgeCircle(
  ctx: CanvasRenderingContext2D,
  count: number,
  cx: number,
  cy: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.fillStyle = "#ef4444";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(radius * 1.2)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = count > 9 ? "9+" : String(count);
  ctx.fillText(text, cx, cy + radius * 0.05);
}

/**
 * Builds a standalone badge-only PNG (transparent background, just the red
 * count circle) as PNG bytes, for the Windows taskbar overlay icon - unlike
 * the favicon badge, this isn't drawn on top of the app icon since
 * setOverlayIcon renders its own icon layered on top of the taskbar icon.
 */
async function buildOverlayIconBytes(count: number): Promise<ArrayBuffer | null> {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }
  try {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    drawBadgeCircle(ctx, count, size / 2, size / 2, size / 2 - 2);

    // toDataURL (synchronous) rather than toBlob (async callback) - more
    // universally reliable across WebView engines for a canvas that was
    // never attached to the DOM, and easier to decode by hand without
    // depending on Blob.arrayBuffer() support.
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    console.warn("[badge] failed to build overlay icon bytes", err);
    return null;
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
        .then(async ({ getCurrentWindow }) => {
          const appWindow = getCurrentWindow();

          // setBadgeCount is macOS dock / Linux only - Tauri's own docs say
          // it is unsupported on Windows and to use setOverlayIcon instead
          // (which is why the Windows taskbar badge never appeared before:
          // this was the only call being made). Left in place since it's
          // still correct for macOS/Linux; it's a no-op/silently ignored on
          // Windows rather than actively harmful.
          if ("setBadgeCount" in appWindow && typeof (appWindow as any).setBadgeCount === "function") {
            (appWindow as any)
              .setBadgeCount(validCount > 0 ? validCount : undefined)
              .catch(() => {});
          }

          // setOverlayIcon is the Windows-only equivalent - draws a small
          // icon over the taskbar app icon. No-ops/rejects harmlessly on
          // macOS/Linux, so no platform check is needed beyond that.
          if ("setOverlayIcon" in appWindow && typeof (appWindow as any).setOverlayIcon === "function") {
            if (validCount > 0) {
              const pngBytes = await buildOverlayIconBytes(validCount);
              if (pngBytes) {
                try {
                  const { Image } = await import("@tauri-apps/api/image");
                  const icon = await Image.fromBytes(new Uint8Array(pngBytes));
                  await (appWindow as any).setOverlayIcon(icon);
                } catch (err) {
                  console.warn("[badge] failed to set Windows taskbar overlay icon", err);
                }
              }
            } else {
              (appWindow as any).setOverlayIcon(undefined).catch(() => {});
            }
          }
        })
        .catch(() => {});
    } catch {
      // Fallback handled by setAppBadge, favicon and window title
    }
  }
}
