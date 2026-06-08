import { create } from "zustand";

interface SpacesState {
  refreshKey: number;
  bumpRefresh: () => void;
}

export const useSpacesStore = create<SpacesState>((set) => ({
  refreshKey: 0,
  bumpRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
