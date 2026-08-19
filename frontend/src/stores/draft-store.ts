import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationDraft {
  plainText: string;
  html?: string;
  updatedAt: number;
}

interface DraftState {
  drafts: Record<string, ConversationDraft>;
  setDraft: (key: string, plainText: string, html?: string) => void;
  clearDraft: (key: string) => void;
  hasDraft: (key: string) => boolean;
}

export function conversationDraftKey(type: "channel" | "dm", id: string) {
  return `${type}:${id}`;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      setDraft: (key, plainText, html) => {
        const trimmed = plainText.trim();
        if (!trimmed) {
          get().clearDraft(key);
          return;
        }
        set((state) => ({
          drafts: {
            ...state.drafts,
            [key]: {
              plainText,
              html,
              updatedAt: Date.now(),
            },
          },
        }));
      },
      clearDraft: (key) => {
        set((state) => {
          if (!state.drafts[key]) return state;
          const next = { ...state.drafts };
          delete next[key];
          return { drafts: next };
        });
      },
      hasDraft: (key) => {
        const d = get().drafts[key];
        return Boolean(d && d.plainText.trim().length > 0);
      },
    }),
    {
      name: "kinetix-chat-drafts",
    }
  )
);
