"use client";

import { useEffect } from "react";
import { isExternalHref, openExternalUrl } from "@/lib/text/open-external-url";

export function ExternalLinkProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function handleGlobalLinkClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;


      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        anchor.hasAttribute("download") ||
        href.startsWith("javascript:") ||
        href.startsWith("#")
      ) {
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
