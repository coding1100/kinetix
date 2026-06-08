import { create } from "zustand";

export type TopBarSheet = "calendar" | "help" | "ai" | null;

interface TopBarState {
  activeSheet: TopBarSheet;
  openSheet: (sheet: Exclude<TopBarSheet, null>) => void;
  closeSheet: () => void;
}

export const useTopBarStore = create<TopBarState>((set) => ({
  activeSheet: null,
  openSheet: (activeSheet) => set({ activeSheet }),
  closeSheet: () => set({ activeSheet: null }),
}));
