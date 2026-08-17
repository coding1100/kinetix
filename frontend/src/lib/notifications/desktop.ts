"use client";

import {
  isPermissionGranted as isTauriPermissionGranted,
  requestPermission as requestTauriPermission,
  sendNotification as sendTauriNotification,
} from "@tauri-apps/plugin-notification";

const NOTIFICATION_ICON = "/riseup-mark-192.png";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI_IPC__" in window || "__TAURI__" in window)
  );
}

function supported(): boolean {
  if (typeof window === "undefined") return false;
  if (isTauri()) return true;
  return "Notification" in window;
}

export function getDesktopPermission(): NotificationPermission | "unsupported" {
  if (!supported()) return "unsupported";
  if (isTauri()) return "granted"; // Handled natively by Tauri Toast system
  return Notification.permission;
}

/**
 * Requests desktop notification permissions from the user.
 */
export async function requestDesktopPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!supported()) return "unsupported";

  if (isTauri()) {
    try {
      const granted = await isTauriPermissionGranted();
      if (granted) return "granted";
      const permission = await requestTauriPermission();
      return permission === "granted" ? "granted" : "denied";
    } catch {
      return "granted";
    }
  }

  try {
    if (Notification.permission === "default") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch (err) {
    console.warn("[desktop notification] failed to request permission", err);
    return "unsupported";
  }
}

/**
 * Displays an OS-level desktop notification (both web browser and native desktop app).
 */
export function showDesktopNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void; ignoreFocusCheck?: boolean }
) {
  if (!supported()) return;

  const { onClick, ignoreFocusCheck = false, body, tag, icon } = options ?? {};

  // Suppress popup ONLY if app is focused & visible and ignoreFocusCheck is false
  if (
    !ignoreFocusCheck &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  ) {
    return;
  }

  // 1. Native Desktop App (Tauri v2)
  if (isTauri()) {
    try {
      sendTauriNotification({
        title,
        body: body ?? undefined,
      });
      return;
    } catch (err) {
      console.warn("[desktop notification] tauri notification fallback to web API", err);
    }
  }

  // 2. Web Browser (Chrome, Edge, Firefox, Safari)
  if (typeof Notification === "undefined") return;

  if (Notification.permission === "granted") {
    triggerWebNotification(title, { body, tag, icon, onClick });
  } else if (Notification.permission === "default") {
    void requestDesktopPermission().then((perm) => {
      if (perm === "granted") {
        triggerWebNotification(title, { body, tag, icon, onClick });
      }
    });
  }
}

function triggerWebNotification(
  title: string,
  options: { body?: string; tag?: string; icon?: string; onClick?: () => void }
) {
  try {
    const notification = new Notification(title, {
      body: options.body ?? undefined,
      tag: options.tag ?? undefined,
      icon: options.icon ?? NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      silent: true,
    });

    notification.onclick = (ev) => {
      ev.preventDefault();
      try {
        if (typeof window !== "undefined") {
          window.focus();
        }
      } catch {
        // ignore window focus restriction errors
      }
      options.onClick?.();
      notification.close();
    };
  } catch (err) {
    console.warn("[desktop notification] failed to create web notification", err);
  }
}

/**
 * Sends a test desktop notification for settings verification.
 */
export function sendTestDesktopNotification() {
  showDesktopNotification("Kinetix Notifications Enabled", {
    body: "Desktop notification previews are working correctly!",
    tag: "test-notification",
    ignoreFocusCheck: true,
  });
}
