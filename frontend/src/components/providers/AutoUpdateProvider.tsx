"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAppBasePath } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";

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
          await update.downloadAndInstall();
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
