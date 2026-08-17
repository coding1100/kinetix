// Native browser Notification API — no library. Same mechanism ClickUp,
// Slack, and Discord's web apps use for OS-level desktop popups.

// Must stay a raster format: Chrome does not support SVG notification icons,
// and on Windows the image is handed to the native toast system, which drops
// the notification outright when it can't decode it.
const NOTIFICATION_ICON = "/riseup-mark-192.png";

function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopPermission(): NotificationPermission | "unsupported" {
  if (!supported()) return "unsupported";
  return Notification.permission;
}

/**
 * Must be called from a user gesture (e.g. flipping the settings toggle) —
 * browsers silently ignore requestPermission() calls made on page load with
 * no click behind them.
 */
export async function requestDesktopPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

/**
 * Shows an OS-level desktop notification. No-op if unsupported, not
 * permitted, or the tab is already focused and visible — a popup for
 * something the user is already looking at is just noise.
 */
export function showDesktopNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void; ignoreFocusCheck?: boolean }
) {
  if (!supported() || Notification.permission !== "granted") return;

  const { onClick, ignoreFocusCheck = false, ...rest } = options ?? {};
  if (!ignoreFocusCheck && document.visibilityState === "visible" && document.hasFocus()) return;

  const notification = new Notification(title, {
    icon: NOTIFICATION_ICON,
    ...rest,
  });
  notification.onclick = () => {
    window.focus();
    onClick?.();
    notification.close();
  };
}
