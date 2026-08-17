"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAppBasePath } from "@/lib/utils";

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isSubscribed = true;
    const basePath = getAppBasePath();
    const versionUrl = `${basePath}/version.json`;

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

        // New deployment build detected!
        if (currentBuildIdRef.current !== data.buildId) {
          console.log(
            `[auto-update] New build detected: ${data.buildId} (current: ${currentBuildIdRef.current})`
          );

          const isBackgrounded =
            document.visibilityState !== "visible" || !document.hasFocus();

          if (isBackgrounded) {
            // Tab is in background / inactive -> silent background reload
            console.log("[auto-update] Silent background reload triggered.");
            window.location.reload();
          } else if (!toastIdRef.current) {
            // Tab is active -> show a non-intrusive update toast
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
      } catch (err) {
        // Ignore network check glitches
      }
    }

    // 1. Initial version register
    void checkVersion();

    // 2. Revalidate when returning to tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };

    // 3. Heartbeat check every 2 minutes
    const interval = setInterval(() => {
      void checkVersion();
    }, 120000);

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, []);

  return <>{children}</>;
}
