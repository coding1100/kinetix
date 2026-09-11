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
    function showManualUpdateRequired() {
      toast.error("A required Kinetix update is available", {
        id: MANUAL_UPDATE_TOAST_ID,
        description:
          "This installation can no longer update itself automatically. Please download and run the latest installer once - after that, updates will resume working automatically.",
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
    async function checkNativeBinaryUpdate() {
      if (!isTauri() || nativeCheckedRef.current) return;
      nativeCheckedRef.current = true;
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update?.available) {
          console.log(
            `[native-updater] Found native binary update: v${update.version}`
          );
          toast.info(`Downloading native desktop update (v${update.version})...`);
          try {
            await update.downloadAndInstall();
          } catch (installErr) {
            // A manifest was found (network/endpoint side is fine) but the
            // install step itself failed - almost always signature
            // verification failing against this binary's old public key,
            // since that's the only step downloadAndInstall performs after
            // an already-successful check(). Surface the manual fallback
            // instead of leaving the user with nothing.
            console.warn(
              "[native-updater] Update found but install failed (likely a signature/key mismatch):",
              installErr
            );
            showManualUpdateRequired();
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
      } catch (err) {
        console.warn(
          "[native-updater] Native binary check skipped or up-to-date:",
          err
        );
      }
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
