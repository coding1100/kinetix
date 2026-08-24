"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getMe, refreshSession } from "@/lib/api/auth";
import { ApiError, setUnauthorizedHandler } from "@/lib/api/client";
import { resetSessionScopedState } from "@/lib/auth/reset-session-scoped-state";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { useAuthStore } from "@/stores/auth-store";

function hasFrontendSessionCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
}

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  ready: false,
  authenticated: false,
});

export function useAuthReady() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [ready, setReady] = useState(false);

  const forceLogout = useCallback(() => {
    useAuthStore.getState().clearSession();
    router.replace(`/auth/login?next=${encodeURIComponent(pathnameRef.current)}`);
  }, [router]);

  const bootstrap = useCallback(async () => {
    const store = useAuthStore.getState();
    const {
      accessToken: token,
      user,
      workspaces,
      activeWorkspaceId,
      updateSession,
      clearSession,
    } = store;

    const hasValidWorkspace =
      workspaces.length > 0 &&
      (activeWorkspaceId
        ? workspaces.some((w) => w.id === activeWorkspaceId)
        : true);

    const hasCachedSession = Boolean(token && user && hasValidWorkspace);

    const tryRefresh = async () => {
      const refreshed = await refreshSession();
      const me = await getMe(refreshed.accessToken);
      updateSession({
        accessToken: refreshed.accessToken,
        user: refreshed.user,
        workspaces: me.workspaces,
      });
    };

    const refreshInBackground = () => {
      void (async () => {
        if (!token || !user) return;
        try {
          const me = await getMe(token);
          updateSession({
            accessToken: token,
            user: {
              id: me.id,
              email: me.email,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
            },
            workspaces: me.workspaces,
          });
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            try {
              await tryRefresh();
            } catch (refreshErr) {
              if (
                refreshErr instanceof ApiError &&
                (refreshErr.status === 401 ||
                  refreshErr.code === "INVALID_REFRESH")
              ) {
                forceLogout();
              }
            }
          }
        }
      })();
    };

    if (hasCachedSession) {
      setReady(true);
      refreshInBackground();
      return;
    }

    try {
      if (token && user) {
        try {
          const me = await getMe(token);
          updateSession({
            accessToken: token,
            user: {
              id: me.id,
              email: me.email,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
            },
            workspaces: me.workspaces,
          });
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            await tryRefresh();
          } else {
            throw err;
          }
        }
      } else {
        await tryRefresh();
      }
    } catch (err) {
      // Only a definitive rejection from the server (refresh token itself
      // is invalid/expired/revoked) should end the session. Anything else —
      // a network blip, a cold-starting backend, a transient 5xx — means we
      // simply couldn't verify the session this time; the httponly refresh
      // cookie (the actual 7-day credential) is untouched, so leave the
      // cached session in place and let the next load/retry succeed instead
      // of forcing the user to log in again.
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.code === "INVALID_REFRESH")
      ) {
        if (token) {
          forceLogout();
        } else {
          clearSession();
        }
      }
    } finally {
      setReady(true);
    }
  }, [forceLogout]);

  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [hydrated, bootstrap]);

  useEffect(() => {
    // Proactively refresh the access token before it expires (well ahead of
    // the backend's jwt_access_expires_minutes) so a tab left open and idle
    // never has to wait for a 401 to notice — it silently rides on the
    // still-valid refresh cookie instead. Without this, a tab with no user-
    // triggered API calls for a few hours only discovers the stale access
    // token on its next request, which is the normal 401-then-refresh path
    // but leaves a window where that refresh could lose a race (see
    // auth_service.refresh_session's grace-period handling).
    const PROACTIVE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour, well under the 4h access token TTL

    const proactiveRefresh = () => {
      if (!useAuthStore.getState().accessToken) return;
      void refreshSession()
        .then((refreshed) => {
          useAuthStore.getState().updateSession({
            accessToken: refreshed.accessToken,
            user: refreshed.user,
            workspaces: useAuthStore.getState().workspaces,
          });
        })
        .catch((err) => {
          if (
            err instanceof ApiError &&
            (err.status === 401 || err.code === "INVALID_REFRESH")
          ) {
            forceLogout();
          }
        });
    };

    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      proactiveRefresh();
    }, PROACTIVE_REFRESH_INTERVAL_MS);

    // A backgrounded tab's timers can be throttled or paused by the browser
    // for far longer than PROACTIVE_REFRESH_INTERVAL_MS, so also refresh
    // immediately on refocus rather than waiting for the next tick.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") proactiveRefresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [forceLogout]);

  useEffect(() => {
    // Non-recoverable 401s force an immediate logout from wherever the user
    // is, instead of waiting for the next hard refresh to notice via
    // bootstrap(): account disabled, or apiFetch's silent access-token
    // refresh failed because the refresh token is itself expired/invalid.
    setUnauthorizedHandler((code) => {
      if (code === "ACCOUNT_DISABLED" || code === "INVALID_REFRESH") {
        forceLogout();
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [forceLogout]);

  useEffect(() => {
    if (!hydrated) return;

    let prevUserId = useAuthStore.getState().user?.id;

    return useAuthStore.subscribe((state) => {
      const nextUserId = state.user?.id;
      if (nextUserId === prevUserId) return;
      prevUserId = nextUserId;
      resetSessionScopedState();
    });
  }, [hydrated]);

  return (
    <AuthContext.Provider
      value={{ ready, authenticated: Boolean(accessToken) }}
    >
      {children}
    </AuthContext.Provider>
  );
}
