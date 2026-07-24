import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HomeSidebarConfig } from "@/lib/api/home";

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  pinned: boolean;
}

export const HOME_SIDEBAR_VISIBLE_IDS = [
  "inbox",
  "assigned-comments",
  "my-tasks",
  "all-tasks",
  "channels",
  "favorites",
] as const;

const DEFAULT_ITEMS: SidebarItem[] = [
  { id: "inbox", label: "Inbox", href: "/home/inbox", pinned: true },
  {
    id: "assigned-comments",
    label: "Assigned Comments",
    href: "/home/assigned-comments",
    pinned: true,
  },
  { id: "my-tasks", label: "My Tasks", href: "/home/my-tasks", pinned: true },
  { id: "all-tasks", label: "All Tasks", href: "/home/all-tasks", pinned: true },
  { id: "channels", label: "All Channels", href: "/home/channels", pinned: false },
  { id: "favorites", label: "Favorites", href: "/home/favorites", pinned: false },
];

function normalizeItems(items: SidebarItem[]): SidebarItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return DEFAULT_ITEMS.map((def) => {
    const saved = byId.get(def.id);
    return saved ? { ...def, pinned: saved.pinned } : def;
  });
}

// Server config only stores a diff (which ids are pinned + their order) - any
// id it doesn't mention (e.g. a nav item shipped after the user last saved)
// falls back to that item's code-defined default, so new items just appear
// with sane defaults instead of needing a migration.
export function toSidebarConfig(
  items: SidebarItem[],
  collapsedSections: string[]
): HomeSidebarConfig {
  return {
    pinnedIds: items.filter((i) => i.pinned).map((i) => i.id),
    order: items.map((i) => i.id),
    collapsedSections,
  };
}

function itemsFromConfig(config: HomeSidebarConfig | null | undefined): SidebarItem[] {
  if (!config) return DEFAULT_ITEMS;
  const byId = new Map(DEFAULT_ITEMS.map((i) => [i.id, i]));
  const orderedIds = config.order.filter((id) => byId.has(id));
  const missingIds = DEFAULT_ITEMS.map((i) => i.id).filter(
    (id) => !orderedIds.includes(id)
  );
  const pinnedSet = new Set(config.pinnedIds);
  return [...orderedIds, ...missingIds].map((id) => ({
    ...byId.get(id)!,
    pinned: pinnedSet.has(id),
  }));
}

interface HomeSidebarState {
  items: SidebarItem[];
  sections: { id: string; name: string }[];
  collapsed: boolean;
  collapsedSections: string[];
  filter: "none" | "unread" | "dms";
  myTasksExpanded: boolean;
  serverSynced: boolean;
  togglePin: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  toggleSectionCollapsed: (id: string) => void;
  hydrateFromServer: (config: HomeSidebarConfig | null) => void;
  setCollapsed: (v: boolean) => void;
  setFilter: (f: "none" | "unread" | "dms") => void;
  setMyTasksExpanded: (v: boolean) => void;
  addSection: (name: string) => void;
}

export const useHomeSidebarStore = create<HomeSidebarState>()(
  persist(
    (set, get) => ({
      items: DEFAULT_ITEMS,
      sections: [],
      collapsed: false,
      collapsedSections: [],
      filter: "none",
      myTasksExpanded: true,
      serverSynced: false,
      togglePin: (id) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, pinned: !i.pinned } : i
          ),
        }),
      reorder: (orderedIds) =>
        set({
          items: orderedIds
            .map((id) => get().items.find((i) => i.id === id))
            .filter((i): i is SidebarItem => Boolean(i)),
        }),
      toggleSectionCollapsed: (id) =>
        set({
          collapsedSections: get().collapsedSections.includes(id)
            ? get().collapsedSections.filter((s) => s !== id)
            : [...get().collapsedSections, id],
        }),
      // Server is the source of truth once it answers - local storage is
      // just the instant-paint cache shown before that response arrives.
      hydrateFromServer: (config) =>
        set({
          items: itemsFromConfig(config),
          collapsedSections: config?.collapsedSections ?? [],
          serverSynced: true,
        }),
      setCollapsed: (collapsed) => set({ collapsed }),
      setFilter: (filter) => set({ filter }),
      setMyTasksExpanded: (myTasksExpanded) => set({ myTasksExpanded }),
      addSection: (name) =>
        set({
          sections: [
            ...get().sections,
            { id: `sec-${Date.now()}`, name },
          ],
        }),
    }),
    {
      name: "riseup-home-sidebar",
      version: 5,
      migrate: (persisted, version) => {
        const state = persisted as HomeSidebarState;
        if (version < 3) {
          return {
            ...state,
            items: DEFAULT_ITEMS,
            myTasksExpanded: true,
            collapsedSections: [],
          };
        }
        return {
          ...state,
          items: normalizeItems(state.items ?? DEFAULT_ITEMS),
          collapsedSections: state.collapsedSections ?? [],
        };
      },
      onRehydrateStorage: () => (state) => {
        // serverSynced reflects THIS session's fetch, never persisted state.
        if (state) state.serverSynced = false;
      },
    }
  )
);

export const MY_TASKS_LINKS = [
  { href: "/home/my-tasks", label: "Overview" },
  { href: "/home/my-tasks/assigned", label: "Assigned to me" },
  { href: "/home/my-tasks/today", label: "Today & Overdue" },
  { href: "/home/my-tasks/personal", label: "Personal List" },
  { href: "/home/my-tasks/lineup", label: "LineUp" },
  { href: "/home/my-tasks/reminders", label: "Reminders" },
  { href: "/home/my-tasks/recents", label: "Recents" },
];
