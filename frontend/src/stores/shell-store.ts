import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SECONDARY_PANEL_MIN_WIDTH = 220;
export const SECONDARY_PANEL_MAX_WIDTH = 480;
export const SECONDARY_PANEL_DEFAULT_WIDTH = 260;

interface ShellState {
  secondaryPanelOpen: boolean;
  setSecondaryPanelOpen: (open: boolean) => void;
  toggleSecondaryPanel: () => void;
  secondaryPanelWidth: number;
  setSecondaryPanelWidth: (width: number) => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set, get) => ({
      secondaryPanelOpen: true,
      setSecondaryPanelOpen: (secondaryPanelOpen) => set({ secondaryPanelOpen }),
      toggleSecondaryPanel: () =>
        set({ secondaryPanelOpen: !get().secondaryPanelOpen }),
      secondaryPanelWidth: SECONDARY_PANEL_DEFAULT_WIDTH,
      setSecondaryPanelWidth: (width) =>
        set({
          secondaryPanelWidth: Math.min(
            SECONDARY_PANEL_MAX_WIDTH,
            Math.max(SECONDARY_PANEL_MIN_WIDTH, width)
          ),
        }),
    }),
    { name: "riseup-shell" }
  )
);
