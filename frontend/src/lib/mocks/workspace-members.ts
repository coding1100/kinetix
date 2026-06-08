export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  online?: boolean;
  dmId?: string;
}

export const MOCK_WORKSPACE_MEMBERS: WorkspaceMember[] = [
  {
    id: "wm1",
    name: "Alex Rivera",
    email: "alex@acme.co",
    online: true,
    dmId: "d1",
  },
  {
    id: "wm2",
    name: "Sam Chen",
    email: "sam@acme.co",
    dmId: "d2",
  },
  {
    id: "wm3",
    name: "Jordan Lee",
    email: "jordan@acme.co",
    online: true,
    dmId: "d3",
  },
  {
    id: "wm4",
    name: "Morgan Blake",
    email: "morgan@acme.co",
    dmId: "d5",
  },
  {
    id: "wm5",
    name: "Taylor Kim",
    email: "taylor@acme.co",
  },
];
