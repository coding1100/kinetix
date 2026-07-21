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
  enabled: boolean;
}[] = [
  { id: "overview", label: "Overview", enabled: true },
  { id: "analytics", label: "Analytics", enabled: false },
  { id: "priorities", label: "Priorities", enabled: false },
  { id: "team", label: "Team", enabled: true },
  { id: "team-chart", label: "Team Chart", enabled: false },
  { id: "standup", label: "StandUp", enabled: false },
  { id: "workload", label: "Workload", enabled: false },
  { id: "timesheet", label: "Timesheet", enabled: false },
];
