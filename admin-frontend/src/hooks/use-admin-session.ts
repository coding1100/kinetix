"use client";

import { useEffect, useState } from "react";
import { adminRefresh } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/stores/auth-store";

/** Silently restores an access token from the httpOnly admin refresh cookie on first load. */
export function useAdminSession() {
  const { accessToken, hydrated, setSession, clearSession } = useAdminAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (accessToken) {
      setReady(true);
      return;
    }
    adminRefresh()
      .then((result) => {
        setSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? null,
          user: result.user,
        });
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return { ready, accessToken };
}
