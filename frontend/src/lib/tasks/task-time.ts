import { PKT_TIME_ZONE } from "@/lib/utils";

export function formatTaskMinutes(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || totalMinutes <= 0) return "Empty";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatTrackedSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return "0h 0m";
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: PKT_TIME_ZONE,
  });
}

/** True for a finished `<input type="date">` value. While a year is typed,
 * Chrome emits each partial year as a real date (0002, 0020, 0202, 2026),
 * so anything before year 1000 is still mid-typing. */
export function isCompleteDateInput(value: string): boolean {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  return Boolean(match && Number(match[1]) >= 1000);
}
