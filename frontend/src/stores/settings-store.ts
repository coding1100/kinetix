import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";

interface SettingsState {
  theme: ThemePreference;
  emailNotifications: boolean;
  desktopNotifications: boolean;
  soundEnabled: boolean;
  setTheme: (theme: ThemePreference) => void;
  setEmailNotifications: (v: boolean) => void;
  setDesktopNotifications: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      emailNotifications: true,
      desktopNotifications: false,
      soundEnabled: true,
      setTheme: (theme) => set({ theme }),
      setEmailNotifications: (emailNotifications) => set({ emailNotifications }),
      setDesktopNotifications: (desktopNotifications) =>
        set({ desktopNotifications }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: "riseup-settings" }
  )
);
