import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  pinned: boolean;
}

export const HOME_SIDEBAR_VISIBLE_IDS = [
  "inbox",
  "replies",
  "channels",
  "all-tasks",
  "my-tasks",
  "favorites",
] as const;

const DEFAULT_ITEMS: SidebarItem[] = [
  { id: "inbox", label: "Inbox", href: "/home/inbox", pinned: true },
  { id: "replies", label: "Replies", href: "/home/replies", pinned: true },
  { id: "channels", label: "All Channels", href: "/home/channels", pinned: true },
  { id: "all-tasks", label: "All Tasks", href: "/home/all-tasks", pinned: true },
  { id: "my-tasks", label: "My Tasks", href: "/home/my-tasks", pinned: true },
  { id: "favorites", label: "Favorites", href: "/home/favorites", pinned: true },
];

function normalizeItems(items: SidebarItem[]): SidebarItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return DEFAULT_ITEMS.map((def) => {
    const saved = byId.get(def.id);
    return saved ? { ...def, pinned: saved.pinned } : def;
  });
}

interface HomeSidebarState {
  items: SidebarItem[];
  sections: { id: string; name: string }[];
  collapsed: boolean;
  filter: "none" | "unread" | "dms";
  myTasksExpanded: boolean;
  togglePin: (id: string) => void;
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
      filter: "none",
      myTasksExpanded: true,
      togglePin: (id) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, pinned: !i.pinned } : i
          ),
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
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as HomeSidebarState;
        if (version < 3) {
          return {
            ...state,
            items: DEFAULT_ITEMS,
            myTasksExpanded: true,
          };
        }
        return { ...state, items: normalizeItems(state.items ?? DEFAULT_ITEMS) };
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
