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
  modalListId: string | null;
  modalStatusId: string | null;
  openModal: (m: Modal, channelId?: string, listId?: string, statusId?: string) => void;
  openModalDeferred: (m: Modal, channelId?: string, listId?: string, statusId?: string) => void;
  closeModal: () => void;
  createMenuOpen: boolean;
  setCreateMenuOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeModal: null,
  modalChannelId: null,
  modalListId: null,
  modalStatusId: null,
  openModal: (activeModal, channelId, listId, statusId) =>
    set({
      activeModal,
      modalChannelId: channelId ?? null,
      modalListId: listId ?? null,
      modalStatusId: statusId ?? null,
    }),
  openModalDeferred: (activeModal, channelId, listId, statusId) => {
    const open = () =>
      set({
        activeModal,
        modalChannelId: channelId ?? null,
        modalListId: listId ?? null,
        modalStatusId: statusId ?? null,
      });
    if (typeof queueMicrotask === "function") {
      queueMicrotask(open);
    } else {
      setTimeout(open, 0);
    }
  },
  closeModal: () =>
    set({ activeModal: null, modalChannelId: null, modalListId: null, modalStatusId: null }),
  createMenuOpen: false,
  setCreateMenuOpen: (createMenuOpen) => set({ createMenuOpen }),
}));
