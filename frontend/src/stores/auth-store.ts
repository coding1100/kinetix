import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, WorkspaceSummary } from "@/lib/api/auth";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/session-cookie";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  hydrated: boolean;
  setHydrated: () => void;
  setSession: (input: {
    accessToken: string;
    refreshToken?: string | null;
    user: AuthUser;
    workspaces?: WorkspaceSummary[];
    activeWorkspaceId?: string;
  }) => void;
  updateSession: (input: {
    accessToken: string;
    refreshToken?: string | null;
    user: AuthUser;
    workspaces: WorkspaceSummary[];
    activeWorkspaceId?: string;
  }) => void;
  setWorkspaces: (workspaces: WorkspaceSummary[]) => void;
  setActiveWorkspace: (id: string) => void;
  updateUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      setSession: ({ accessToken, refreshToken, user, workspaces, activeWorkspaceId }) => {
        setSessionCookie();
        set({
          accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          user,
          workspaces: workspaces ?? [],
          activeWorkspaceId:
            activeWorkspaceId ?? workspaces?.[0]?.id ?? null,
        });
      },
      updateSession: ({ accessToken, refreshToken, user, workspaces, activeWorkspaceId }) => {
        setSessionCookie();
        const currentActive = get().activeWorkspaceId;
        const nextActive =
          activeWorkspaceId ??
          (currentActive && workspaces.some((w) => w.id === currentActive)
            ? currentActive
            : workspaces[0]?.id ?? null);
        set({
          accessToken,
          refreshToken: refreshToken ?? get().refreshToken,
          user,
          workspaces,
          activeWorkspaceId: nextActive,
        });
      },
      setWorkspaces: (workspaces) => set({ workspaces }),
      setActiveWorkspace: (activeWorkspaceId) => set({ activeWorkspaceId }),
      updateUser: (user) => set({ user }),
      clearSession: () => {
        clearSessionCookie();
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          workspaces: [],
          activeWorkspaceId: null,
        });
      },
    }),
    {
      name: "riseup-auth",
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        workspaces: s.workspaces,
        activeWorkspaceId: s.activeWorkspaceId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) setSessionCookie();
        state?.setHydrated();
      },
    }
  )
);

export function selectActiveWorkspace(state: AuthState) {
  return (
    state.workspaces.find((w) => w.id === state.activeWorkspaceId) ??
    state.workspaces[0] ??
    null
  );
}

export function workspaceInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "WS";
}
