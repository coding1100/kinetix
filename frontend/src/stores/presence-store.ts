import { create } from "zustand";
import type { PresenceStatus } from "@/stores/profile-store";

interface PresenceState {
  workspaceId: string | null;
  byUserId: Record<string, PresenceStatus>;
  setWorkspace: (workspaceId: string | null) => void;
  syncPresence: (
    workspaceId: string,
    users: { userId: string; status: PresenceStatus }[]
  ) => void;
  upsertPresence: (
    workspaceId: string,
    userId: string,
    status: PresenceStatus
  ) => void;
  seedPresence: (entries: { userId: string; status: PresenceStatus }[]) => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  workspaceId: null,
  byUserId: {},
  setWorkspace: (workspaceId) => set({ workspaceId, byUserId: {} }),
  syncPresence: (workspaceId, users) =>
    set((state) => {
      if (state.workspaceId && state.workspaceId !== workspaceId) {
        return state;
      }
      const byUserId = { ...state.byUserId };
      for (const user of users) {
        byUserId[user.userId] = user.status;
      }
      return { workspaceId, byUserId };
    }),
  upsertPresence: (workspaceId, userId, status) =>
    set((state) => {
      if (state.workspaceId && state.workspaceId !== workspaceId) {
        return state;
      }
      return {
        workspaceId: state.workspaceId ?? workspaceId,
        byUserId: { ...state.byUserId, [userId]: status },
      };
    }),
  seedPresence: (entries) =>
    set((state) => {
      const byUserId = { ...state.byUserId };
      for (const entry of entries) {
        if (!(entry.userId in byUserId)) {
          byUserId[entry.userId] = entry.status;
        }
      }
      return { byUserId };
    }),
}));

export function useUserPresence(
  userId: string | null | undefined,
  fallback: PresenceStatus = "offline"
): PresenceStatus {
  return usePresenceStore((s) =>
    userId ? (s.byUserId[userId] ?? fallback) : fallback
  );
}
