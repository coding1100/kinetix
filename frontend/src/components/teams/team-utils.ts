export function teamHandle(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `@${slug}` : "@team";
}

export type TeamDetailTab =
  | "overview"
  | "analytics"
  | "priorities"
  | "team"
  | "team-chart"
  | "standup"
  | "workload"
  | "timesheet";

export const TEAM_DETAIL_TABS: {
  id: TeamDetailTab;
  label: string;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "priorities", label: "Priorities" },
  { id: "team", label: "Team" },
  { id: "team-chart", label: "Team Chart" },
  { id: "standup", label: "StandUp" },
  { id: "workload", label: "Workload" },
  { id: "timesheet", label: "Timesheet" },
];
