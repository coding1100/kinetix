"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/stores/auth-store";

/**
 * No persistence, no silent cookie-based restore - every fresh mount of the
 * admin portal (new tab, reload, browser restart) requires a real login.
 * Bounces to /login the moment there's no in-memory access token.
 */
export function useAdminSession() {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAdminAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return { ready: true, accessToken };
}
