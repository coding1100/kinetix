export interface MockPost {
  id: string;
  author: string;
  channel: string;
  content: string;
  createdAt: Date;
  reactions: number;
}

export const MOCK_POSTS: MockPost[] = [
  {
    id: "p1",
    author: "Jordan Lee",
    channel: "announcements",
    content:
      "Q2 planning starts Thursday — please review the doc in #product.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    reactions: 12,
  },
  {
    id: "p2",
    author: "Alex Rivera",
    channel: "product",
    content: "Home 4.0 sidebar parity checklist is live. Feedback welcome!",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    reactions: 8,
  },
  {
    id: "p3",
    author: "Sam Chen",
    channel: "design",
    content: "Updated color tokens to match Kinetix design reference.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
    reactions: 5,
  },
];
