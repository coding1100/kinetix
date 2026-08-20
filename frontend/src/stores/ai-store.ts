import { create } from "zustand";

interface AiState {
  isKnowledgeAssistantOpen: boolean;
  activeQuery: string;
  openKnowledgeAssistant: (query?: string) => void;
  closeKnowledgeAssistant: () => void;
  toggleKnowledgeAssistant: () => void;
}

export const useAiStore = create<AiState>()((set) => ({
  isKnowledgeAssistantOpen: false,
  activeQuery: "",
  openKnowledgeAssistant: (query = "") =>
    set({ isKnowledgeAssistantOpen: true, activeQuery: query }),
  closeKnowledgeAssistant: () => set({ isKnowledgeAssistantOpen: false }),
  toggleKnowledgeAssistant: () =>
    set((s) => ({ isKnowledgeAssistantOpen: !s.isKnowledgeAssistantOpen })),
}));
