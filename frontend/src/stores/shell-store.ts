import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ShellState {
  secondaryPanelOpen: boolean;
  setSecondaryPanelOpen: (open: boolean) => void;
  toggleSecondaryPanel: () => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set, get) => ({
      secondaryPanelOpen: true,
      setSecondaryPanelOpen: (secondaryPanelOpen) => set({ secondaryPanelOpen }),
      toggleSecondaryPanel: () =>
        set({ secondaryPanelOpen: !get().secondaryPanelOpen }),
    }),
    { name: "riseup-shell" }
  )
);
