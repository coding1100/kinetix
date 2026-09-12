"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAppBasePath } from "@/lib/utils";
import { isTauri, desktopUpdateTarget } from "@/lib/tauri";

const MANUAL_UPDATE_TOAST_ID = "manual-desktop-update-required";

type VersionManifest = {
  version: string;
  buildId: string;
  gitSha: string;
  timestamp: string;
};

export function AutoUpdateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentBuildIdRef = useRef<string | null>(null);
  const toastIdRef = useRef<string | number | null>(null);
  const nativeCheckedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isSubscribed = true;
    const basePath = getAppBasePath();
    const versionUrl = `${basePath}/version.json`;

    // 1. Silent Web Asset Hot-Reload Checker
    async function checkVersion() {
      try {
        const res = await fetch(`${versionUrl}?_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });

        if (!res.ok) return;
        const data: VersionManifest = await res.json();
        if (!data?.buildId || !isSubscribed) return;

        if (!currentBuildIdRef.current) {
          currentBuildIdRef.current = data.buildId;
          return;
        }

        if (currentBuildIdRef.current !== data.buildId) {
          console.log(
            `[auto-update] New build detected: ${data.buildId} (current: ${currentBuildIdRef.current})`
          );

          const isBackgrounded =
            document.visibilityState !== "visible" || !document.hasFocus();

          if (isBackgrounded) {
            console.log("[auto-update] Silent background reload triggered.");
            window.location.reload();
          } else if (!toastIdRef.current) {
            toastIdRef.current = toast("New Kinetix update ready", {
              description:
                "All fixes are applied. Click to update now or it will update on tab switch.",
              duration: Infinity,
              action: {
                label: "Update Now",
                onClick: () => {
                  window.location.reload();
                },
              },
            });
          }
        }
      } catch {
        // Ignore network check glitches
      }
    }

    // Shown when a newer version exists but this install can never verify
    // it (its compiled-in public key predates a signing-key rotation) - the
    // plugin's own check()/downloadAndInstall() can only ever fail silently
    // for this install, so this is the one thing that can actually reach
    // these users: a persistent, non-dismissible notice with a direct link
    // to the real installer (not the updater's .zip-wrapped artifact).
    function showManualUpdateRequired(reason?: string) {
      // Cap the underlying error text - some failure sources (Rust error
      // strings passed through as-is) can be much longer than a toast
      // should ever try to hold, regardless of the toast's own responsive
      // width/wrap fixes.
      const trimmedReason =
        reason && reason.length > 140 ? `${reason.slice(0, 140)}…` : reason;
      toast.error("A required Kinetix update is available", {
        id: MANUAL_UPDATE_TOAST_ID,
        description: `This installation can no longer update itself automatically. Please download and run the latest installer once - after that, updates will resume working automatically.${
          trimmedReason ? ` (${trimmedReason})` : ""
        }`,
        duration: Infinity,
        closeButton: false,
        action: {
          label: "Download Update",
          onClick: () => {
            const target = desktopUpdateTarget();
            window.open(
              `https://kinetix.mindrind.com/api/v1/desktop/download/${target}`,
              "_blank"
            );
          },
        },
      });
    }

    // 2. Option B: Native Desktop Binary Auto-Updater (Tauri Plugin-Updater)
    //
    // Every failure path here ends in showManualUpdateRequired() rather than
    // a silent console.warn. The whole point of this provider is that a
    // desktop build which cannot update itself must still TELL the user so
    // they can install manually - a silently-swallowed error leaves them
    // stranded on an old build forever with no signal at all, which is
    // exactly what happened before.
    async function checkNativeBinaryUpdate() {
      if (!isTauri() || nativeCheckedRef.current) return;
      nativeCheckedRef.current = true;

      let update: Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater").check>>;
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        update = await check();
      } catch (checkErr) {
        // check() itself failing means the plugin couldn't even reach or
        // parse the endpoint (permission denied, network, bad manifest).
        // Can't distinguish "no update" from "broken" here, so surface the
        // manual path - worst case the user downloads a build they're
        // already on, which is harmless.
        console.warn("[native-updater] check() failed:", checkErr);
        showManualUpdateRequired(
          `Update check failed: ${checkErr instanceof Error ? checkErr.message : String(checkErr)}`
        );
        return;
      }

      if (!update?.available) {
        console.log("[native-updater] No update available - already current.");
        return;
      }

      console.log(`[native-updater] Found native binary update: v${update.version}`);
      toast.info(`Downloading native desktop update (v${update.version})...`);

      try {
        await update.downloadAndInstall();
      } catch (installErr) {
        // A manifest was found (network/endpoint side is fine) but the
        // install step itself failed - most often signature verification
        // against this binary's old public key, but it can also be a
        // download or file-permission failure. Either way the user needs
        // the manual path.
        console.warn(
          "[native-updater] Update found but install failed:",
          installErr
        );
        showManualUpdateRequired(
          `Automatic install failed: ${installErr instanceof Error ? installErr.message : String(installErr)}`
        );
        return;
      }

      toast("Native Desktop Update Ready", {
        description: `Version v${update.version} installed. Click to restart Kinetix and apply native update.`,
        duration: Infinity,
        action: {
          label: "Restart Now",
          onClick: () => {
            const win = window as any;
            if (win.__TAURI_INTERNALS__?.invoke) {
              void win.__TAURI_INTERNALS__.invoke("plugin:process|restart").catch(() => {
                window.location.reload();
              });
            } else {
              window.location.reload();
            }
          },
        },
      });
    }

    void checkVersion();
    void checkNativeBinaryUpdate();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };

    const interval = setInterval(() => {
      void checkVersion();
    }, 120000);

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityOrFocus
      );
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, []);

  return <>{children}</>;
}
