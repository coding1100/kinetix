import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type SoundPreset = "chime" | "pop" | "ping" | "soft" | "bell" | "breeze";

interface SettingsState {
  theme: ThemePreference;
  emailNotifications: boolean;
  desktopNotifications: boolean;
  desktopNotificationPromptDismissed: boolean;
  soundEnabled: boolean;
  soundPreset: SoundPreset;
  setTheme: (theme: ThemePreference) => void;
  setEmailNotifications: (v: boolean) => void;
  setDesktopNotifications: (v: boolean) => void;
  setDesktopNotificationPromptDismissed: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setSoundPreset: (preset: SoundPreset) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      emailNotifications: true,
      desktopNotifications: false,
      desktopNotificationPromptDismissed: false,
      soundEnabled: true,
      soundPreset: "chime",
      setTheme: (theme) => set({ theme }),
      setEmailNotifications: (emailNotifications) => set({ emailNotifications }),
      setDesktopNotifications: (desktopNotifications) =>
        set({ desktopNotifications }),
      setDesktopNotificationPromptDismissed: (desktopNotificationPromptDismissed) =>
        set({ desktopNotificationPromptDismissed }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundPreset: (soundPreset) => set({ soundPreset }),
    }),
    { name: "riseup-settings" }
  )
);
