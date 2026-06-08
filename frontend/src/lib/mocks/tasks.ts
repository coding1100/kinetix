export interface MockTaskComment {
  id: string;
  author: string;
  body: string;
  at: string;
}

export interface MockTask {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  dueDate?: string;
  assignees: string[];
  list: string;
  space: string;
  priority?: "urgent" | "high" | "normal" | "low";
  overdue?: boolean;
  description?: string;
  comments?: MockTaskComment[];
}

export const MOCK_TASKS: MockTask[] = [
  {
    id: "t1",
    name: "Implement Inbox All/Later tabs",
    status: "in progress",
    statusColor: "#4194f6",
    dueDate: "Today",
    assignees: ["You"],
    list: "Frontend",
    space: "Product",
    priority: "high",
    description:
      "Build All and Later tabs with grouped mock inbox cards and deep links into Chat.",
    comments: [
      {
        id: "c1",
        author: "Alex Rivera",
        body: "Use the same card hover ring as chat activity.",
        at: "2h ago",
      },
    ],
  },
  {
    id: "t2",
    name: "Chat thread panel layout",
    status: "to do",
    statusColor: "#87909e",
    dueDate: "Tomorrow",
    assignees: ["You", "Alex"],
    list: "Frontend",
    space: "Product",
  },
  {
    id: "t3",
    name: "Review assigned comments UI",
    status: "in progress",
    statusColor: "#4194f6",
    dueDate: "Jun 3",
    assignees: ["You"],
    list: "QA",
    space: "Engineering",
    overdue: true,
    description: "Align assigned comments layout with Kinetix Home inbox rows.",
    comments: [
      {
        id: "c2",
        author: "Jordan Lee",
        body: "Please verify OAuth redirect URLs in the spec.",
        at: "Yesterday",
      },
    ],
  },
  {
    id: "t4",
    name: "Personal: Book team offsite",
    status: "open",
    statusColor: "#5f55ee",
    assignees: ["You"],
    list: "Personal List",
    space: "Personal",
  },
  {
    id: "t5",
    name: "Wire cross-links Home to Chat",
    status: "to do",
    statusColor: "#87909e",
    dueDate: "Jun 5",
    assignees: ["You"],
    list: "Frontend",
    space: "Product",
  },
];

export const MOCK_RECENTS = [
  {
    id: "r1",
    name: "Sprint 12 Board",
    type: "List",
    space: "Engineering",
    href: "/home/spaces/s2",
  },
  {
    id: "r2",
    name: "API Spec",
    type: "Doc",
    space: "Product",
    href: "/home/tasks/t3",
  },
  {
    id: "r3",
    name: "#product",
    type: "Channel",
    space: "Chat",
    href: "/chat/c/c2",
  },
];

export const MOCK_REMINDERS = [
  { id: "rm1", title: "Standup prep", due: "Today 9:00 AM" },
  { id: "rm2", title: "Send weekly update", due: "Friday 4:00 PM" },
];

export const MOCK_FAVORITES = [
  { id: "f1", name: "Sprint Board", type: "List", href: "/home/spaces/s2" },
  { id: "f2", name: "Inbox", type: "View", href: "/home/inbox" },
  { id: "f3", name: "#general", type: "Channel", href: "/chat/c/c1" },
];

export function getTaskById(id: string) {
  return MOCK_TASKS.find((t) => t.id === id);
}
