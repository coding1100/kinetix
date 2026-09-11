import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type SoundPreset =
  | "chime"
  | "pop"
  | "ping"
  | "soft"
  | "bell"
  | "breeze"
  | "loud-alert";

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
      soundPreset: "loud-alert",
      setTheme: (theme) => set({ theme }),
      setEmailNotifications: (emailNotifications) => set({ emailNotifications }),
      setDesktopNotifications: (desktopNotifications) =>
        set({ desktopNotifications }),
      setDesktopNotificationPromptDismissed: (desktopNotificationPromptDismissed) =>
        set({ desktopNotificationPromptDismissed }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundPreset: (soundPreset) => set({ soundPreset }),
    }),
    {
      name: "riseup-settings",
      // v1 -> v2: switch every user still on the old default ("chime") over
      // to the new louder "loud-alert" preset. Anyone who had explicitly
      // picked a different preset (pop/ping/soft/bell/breeze) keeps their
      // choice - only the previous default value is migrated.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { soundPreset?: SoundPreset } | undefined;
        if (state && state.soundPreset === "chime") {
          state.soundPreset = "loud-alert";
        }
        return state;
      },
    }
  )
);
