import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PresenceStatus = "online" | "away" | "busy" | "offline";

interface ProfileState {
  statusText: string;
  presence: PresenceStatus;
  mutedUntil: number | null;
  pinnedToolIds: string[];
  setStatusText: (text: string) => void;
  setPresence: (presence: PresenceStatus) => void;
  setMutedUntil: (until: number | null) => void;
  togglePinnedTool: (id: string) => void;
  isMuted: () => boolean;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      statusText: "",
      presence: "online",
      mutedUntil: null,
      pinnedToolIds: ["create-task", "record-clip", "create-doc", "create-dashboard"],
      setStatusText: (statusText) => set({ statusText }),
      setPresence: (presence) => set({ presence }),
      setMutedUntil: (mutedUntil) => set({ mutedUntil }),
      togglePinnedTool: (id) =>
        set((state) => {
          const pinned = state.pinnedToolIds.includes(id);
          return {
            pinnedToolIds: pinned
              ? state.pinnedToolIds.filter((x) => x !== id)
              : [...state.pinnedToolIds, id],
          };
        }),
      isMuted: () => {
        const until = get().mutedUntil;
        if (until == null) return false;
        if (until === -1) return true;
        return Date.now() < until;
      },
    }),
    { name: "riseup-profile" }
  )
);

export function presenceLabel(presence: PresenceStatus) {
  switch (presence) {
    case "online":
      return "Online";
    case "away":
      return "Away";
    case "busy":
      return "Busy";
    default:
      return "Offline";
  }
}

export function presenceDotClass(presence: PresenceStatus) {
  switch (presence) {
    case "online":
      return "bg-[#24ce62]";
    case "away":
      return "bg-amber-500";
    case "busy":
      return "bg-red-500";
    default:
      return "";
  }
}

/** ClickUp-style hollow ring for offline users */
export function presenceOfflineDotClass() {
  return "bg-sidebar border-[#c9c9c9]";
}
