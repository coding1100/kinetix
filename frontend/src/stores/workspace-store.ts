import { create } from "zustand";

type WorkspaceStore = {
  peopleRefreshKey: number;
  bumpPeopleRefresh: () => void;
};

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  peopleRefreshKey: 0,
  bumpPeopleRefresh: () =>
    set((s) => ({ peopleRefreshKey: s.peopleRefreshKey + 1 })),
}));

export function bumpWorkspacePeopleRefresh() {
  useWorkspaceStore.getState().bumpPeopleRefresh();
}
