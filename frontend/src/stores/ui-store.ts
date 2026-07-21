import { create } from "zustand";

type Modal =
  | "customize-home"
  | "create-task"
  | "new-channel"
  | "new-dm"
  | "schedule-message"
  | "invite-people"
  | "channel-share"
  | "channel-files"
  | "syncup"
  | "rename-channel"
  | null;

interface UiState {
  activeModal: Modal;
  modalChannelId: string | null;
  openModal: (m: Modal, channelId?: string) => void;
  openModalDeferred: (m: Modal, channelId?: string) => void;
  closeModal: () => void;
  createMenuOpen: boolean;
  setCreateMenuOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeModal: null,
  modalChannelId: null,
  openModal: (activeModal, channelId) =>
    set({ activeModal, modalChannelId: channelId ?? null }),
  openModalDeferred: (activeModal, channelId) => {
    const open = () =>
      set({ activeModal, modalChannelId: channelId ?? null });
    if (typeof queueMicrotask === "function") {
      queueMicrotask(open);
    } else {
      setTimeout(open, 0);
    }
  },
  closeModal: () => set({ activeModal: null, modalChannelId: null }),
  createMenuOpen: false,
  setCreateMenuOpen: (createMenuOpen) => set({ createMenuOpen }),
}));
