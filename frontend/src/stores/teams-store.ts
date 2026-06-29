import { create } from "zustand";

interface TeamsState {
  refreshKey: number;
  bumpRefresh: () => void;
}

export const useTeamsStore = create<TeamsState>((set) => ({
  refreshKey: 0,
  bumpRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
