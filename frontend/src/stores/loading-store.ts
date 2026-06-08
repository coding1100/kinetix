import { create } from "zustand";

interface LoadingState {
  count: number;
  message: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  resetLoading: () => void;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  count: 0,
  message: "Loading…",
  showLoading: (message) =>
    set((state) => ({
      count: state.count + 1,
      message: message !== undefined ? message : "Loading…",
    })),
  hideLoading: () =>
    set((state) => ({
      count: Math.max(0, state.count - 1),
    })),
  resetLoading: () => set({ count: 0, message: "Loading…" }),
}));

export function selectIsLoading(state: LoadingState) {
  return state.count > 0;
}
