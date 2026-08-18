import { create } from "zustand";
import type { AuthUser, WorkspaceSummary } from "@/lib/api/auth";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/session-cookie";

export function firstSelectableWorkspaceId(workspaces: WorkspaceSummary[]) {
  return (
    workspaces.find((w) => w.membershipStatus !== "SUSPENDED")?.id ?? null
  );
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  hydrated: boolean;
  setHydrated: () => void;
  setSession: (input: {
    accessToken: string;
    user: AuthUser;
    workspaces?: WorkspaceSummary[];
    activeWorkspaceId?: string;
  }) => void;
  updateSession: (input: {
    accessToken: string;
    user: AuthUser;
    workspaces: WorkspaceSummary[];
    activeWorkspaceId?: string;
  }) => void;
  setWorkspaces: (workspaces: WorkspaceSummary[]) => void;
  setActiveWorkspace: (id: string) => void;
  updateUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
      accessToken: null,
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      hydrated: true,
      setHydrated: () => set({ hydrated: true }),
      setSession: ({ accessToken, user, workspaces, activeWorkspaceId }) => {
        setSessionCookie();
        set({
          accessToken,
          user,
          workspaces: workspaces ?? [],
          activeWorkspaceId:
            activeWorkspaceId ?? firstSelectableWorkspaceId(workspaces ?? []),
        });
      },
      updateSession: ({ accessToken, user, workspaces, activeWorkspaceId }) => {
        setSessionCookie();
        const currentActive = get().activeWorkspaceId;
        const currentIsSelectable = workspaces.find(
          (w) => w.id === currentActive
        )?.membershipStatus !== "SUSPENDED";
        const nextActive =
          activeWorkspaceId ??
          (currentActive &&
          currentIsSelectable &&
          workspaces.some((w) => w.id === currentActive)
            ? currentActive
            : firstSelectableWorkspaceId(workspaces));
        set({
          accessToken,
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
          user: null,
          workspaces: [],
          activeWorkspaceId: null,
        });
      },
    }));

export function selectActiveWorkspace(state: AuthState) {
  return (
    state.workspaces.find((w) => w.id === state.activeWorkspaceId) ??
    state.workspaces.find((w) => w.membershipStatus !== "SUSPENDED") ??
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
