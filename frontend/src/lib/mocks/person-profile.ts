export type PersonActivityEntry = {
  id: string;
  dateLabel: string;
  project: string;
  breadcrumbs: string;
  action: string;
  fromStatus: { label: string; color: string };
  toStatus: { label: string; color: string };
  timestamp: string;
};

export function mockPersonActivity(name: string): PersonActivityEntry[] {
  const first = name.split(" ")[0] || name;
  return [
    {
      id: "a1",
      dateLabel: new Date().toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
      }),
      project: "Smart Reply UI",
      breadcrumbs: "Engineering Team / Projects",
      action: `${first} changed status from Todo to In Progress`,
      fromStatus: { label: "Todo", color: "bg-zinc-400" },
      toStatus: { label: "In Progress", color: "bg-sky-500" },
      timestamp: "Jun 1 at 4:31 pm",
    },
    {
      id: "a2",
      dateLabel: new Date(Date.now() - 86400000).toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
        year: "2-digit",
      }),
      project: "Clickup Clone - UI screens for Home and Chat",
      breadcrumbs: "Engineering Team / Projects",
      action: `${first} changed status from Backlog to Todo`,
      fromStatus: { label: "Backlog", color: "bg-zinc-700" },
      toStatus: { label: "Todo", color: "bg-zinc-400" },
      timestamp: "Jun 1 at 2:10 pm",
    },
  ];
}
