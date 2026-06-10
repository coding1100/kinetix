"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getMe, refreshSession } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
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
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [ready, setReady] = useState(false);

  const bootstrap = useCallback(async () => {
    const store = useAuthStore.getState();
    const {
      accessToken: token,
      refreshToken: storedRefresh,
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
      const refreshed = await refreshSession(storedRefresh);
      const me = await getMe(refreshed.accessToken);
      updateSession({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? storedRefresh,
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
                clearSession();
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
      } else if (hasFrontendSessionCookie() || storedRefresh) {
        await tryRefresh();
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.code === "INVALID_REFRESH")
      ) {
        clearSession();
      } else if (!token) {
        clearSession();
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [hydrated, bootstrap]);

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
