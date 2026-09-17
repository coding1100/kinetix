"use client";

import { useEffect } from "react";
import { isExternalHref, openExternalUrl } from "@/lib/text/open-external-url";
import { downloadFileWithFeedback } from "@/lib/files/download";

export function ExternalLinkProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function handleGlobalLinkClick(e: MouseEvent) {
      // Ignore programmatic clicks (e.g. synthetic anchor.click() triggered to initiate download)
      if (!e.isTrusted) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      // Ignore elements marked as native downloads to prevent recursive loops
      if (
        anchor.dataset.nativeDownload === "true" ||
        anchor.hasAttribute("data-native-download")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("javascript:") || href.startsWith("#")) {
        return;
      }

      if (anchor.hasAttribute("download")) {
        e.preventDefault();
        e.stopPropagation();
        const fileName = anchor.getAttribute("download") || href.split("/").pop() || "download";
        void downloadFileWithFeedback(href, fileName);
        return;
      }

      const isTargetBlank = anchor.target === "_blank";
      if (isExternalHref(href) || isTargetBlank) {
        e.preventDefault();
        e.stopPropagation();
        void openExternalUrl(href);
      }
    }

    document.addEventListener("click", handleGlobalLinkClick, true);
    return () => {
      document.removeEventListener("click", handleGlobalLinkClick, true);
    };
  }, []);

  return <>{children}</>;
}
