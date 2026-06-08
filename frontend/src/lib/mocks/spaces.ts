export interface MockSpaceList {
  id: string;
  name: string;
  taskCount: number;
}

export interface MockSpaceFolder {
  id: string;
  name: string;
  lists: MockSpaceList[];
}

export interface MockSpace {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  listCount: number;
  description?: string;
  folders?: MockSpaceFolder[];
  standaloneLists?: MockSpaceList[];
}

export const MOCK_SPACES: MockSpace[] = [
  {
    id: "s1",
    name: "Product",
    color: "#7B68EE",
    memberCount: 14,
    listCount: 8,
    description: "Product planning, roadmap, and delivery.",
    folders: [
      {
        id: "f1",
        name: "Roadmap",
        lists: [
          { id: "l1", name: "Sprint 12", taskCount: 12 },
          { id: "l2", name: "Backlog", taskCount: 24 },
        ],
      },
    ],
    standaloneLists: [{ id: "l3", name: "Frontend", taskCount: 8 }],
  },
  {
    id: "s2",
    name: "Engineering",
    color: "#4194f6",
    memberCount: 22,
    listCount: 12,
    description: "Engineering delivery and infrastructure.",
    folders: [
      {
        id: "f2",
        name: "Platform",
        lists: [
          { id: "l4", name: "API", taskCount: 15 },
          { id: "l5", name: "QA", taskCount: 9 },
        ],
      },
    ],
  },
  {
    id: "s3",
    name: "Design",
    color: "#E93D82",
    memberCount: 6,
    listCount: 4,
    description: "Design system and UX research.",
    standaloneLists: [{ id: "l6", name: "UI Polish", taskCount: 6 }],
  },
];

export function getSpaceById(id: string) {
  return MOCK_SPACES.find((s) => s.id === id);
}
