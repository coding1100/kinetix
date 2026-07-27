"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/stores/auth-store";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "wheel", "touchstart"] as const;

/**
 * No persistence, no silent cookie-based restore - every fresh mount of the
 * admin portal (new tab, reload, browser restart) requires a real login.
 * Bounces to /login the moment there's no in-memory access token, and also
 * after IDLE_TIMEOUT_MS of no user activity while a session is active.
 */
export function useAdminSession() {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const clearSession = useAdminAuthStore((s) => s.clearSession);

  useEffect(() => {
    if (!accessToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const onIdle = () => {
      void adminLogout().finally(() => {
        clearSession();
        router.replace(`/login?next=${encodeURIComponent(pathname)}&reason=idle`);
      });
    };

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(onIdle, IDLE_TIMEOUT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return { ready: true, accessToken };
}
