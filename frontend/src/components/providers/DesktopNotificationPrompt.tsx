"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  getDesktopPermission,
  requestDesktopPermission,
  sendTestDesktopNotification,
} from "@/lib/notifications/desktop";

const PROMPT_DELAY_MS = 15_000;

/**
 * One-time, dismissible nudge asking a logged-in user to enable desktop
 * notifications. `desktopNotifications` defaults to off (browsers only
 * honor a permission request from a real user gesture, so we can't just
 * request it automatically on load) — without this nudge most users never
 * discover the Settings toggle and are left wondering why they hear the
 * notification sound but never see an OS/Chrome popup.
 */
export function DesktopNotificationPrompt() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!accessToken || shownRef.current) return;

    const { desktopNotifications, desktopNotificationPromptDismissed } =
      useSettingsStore.getState();
    if (desktopNotifications || desktopNotificationPromptDismissed) return;

    const permission = getDesktopPermission();
    if (permission === "unsupported" || permission === "denied") {
      // Already blocked or unsupported: no amount of nudging will help,
      // and re-prompting a denied permission is a dead end in Chrome.
      useSettingsStore.getState().setDesktopNotificationPromptDismissed(true);
      return;
    }
    if (permission === "granted") {
      // Permission already granted from a previous session/browser profile
      // sync; just flip the setting on instead of asking again.
      useSettingsStore.getState().setDesktopNotifications(true);
      return;
    }

    const timer = window.setTimeout(() => {
      if (shownRef.current) return;
      shownRef.current = true;

      const dismiss = () => {
        useSettingsStore.getState().setDesktopNotificationPromptDismissed(true);
      };

      toast("Turn on desktop notifications?", {
        description:
          "Get notified on this device even when Kinetix isn't the active tab.",
        duration: 15_000,
        onDismiss: dismiss,
        onAutoClose: dismiss,
        action: {
          label: "Enable",
          onClick: () => {
            void requestDesktopPermission().then((result) => {
              if (result === "granted") {
                useSettingsStore.getState().setDesktopNotifications(true);
                useSettingsStore
                  .getState()
                  .setDesktopNotificationPromptDismissed(true);
                sendTestDesktopNotification();
                toast.success("Desktop notifications enabled");
              } else {
                // Denied or unsupported: don't ask again this session/device.
                useSettingsStore
                  .getState()
                  .setDesktopNotificationPromptDismissed(true);
                if (result === "denied") {
                  toast.error(
                    "Desktop notifications are blocked in your browser settings"
                  );
                }
              }
            });
          },
        },
        cancel: {
          label: "Not now",
          onClick: dismiss,
        },
      });
    }, PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [accessToken]);

  return null;
}
