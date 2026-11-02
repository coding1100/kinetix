import { describe, expect, it } from "vitest";
import {
  taskStatusColorFromKey,
  taskStatusKeyFromLabel,
  taskStatusLabelFromKey,
  TASK_STATUS_COLUMNS,
} from "@/lib/task-status";
import { taskPriorityLabel, TASK_PRIORITIES } from "@/lib/task-priority";
import { formatShortDateTimeUtc } from "@/lib/utils";
import { isCompleteDateInput } from "@/lib/tasks/task-time";

describe("task-status", () => {
  it("maps labels to keys and back", () => {
    for (const col of TASK_STATUS_COLUMNS) {
      expect(taskStatusKeyFromLabel(col.label)).toBe(col.key);
      expect(taskStatusLabelFromKey(col.key)).toBe(col.label);
      expect(taskStatusColorFromKey(col.key)).toBe(col.color);
    }
  });

  it("falls back for unknown label or key", () => {
    expect(taskStatusKeyFromLabel("unknown")).toBe("TODO");
    expect(taskStatusLabelFromKey("UNKNOWN" as "TODO")).toBe("to do");
    expect(taskStatusColorFromKey("UNKNOWN" as "TODO")).toBe("#87909e");
  });
});

describe("task-priority", () => {
  it("returns labels for all priorities", () => {
    for (const p of TASK_PRIORITIES) {
      expect(taskPriorityLabel(p.value)).toBe(p.label);
    }
  });

  it("returns empty string when priority is undefined", () => {
    expect(taskPriorityLabel(undefined)).toBe("");
  });
});

describe("formatShortDateTimeUtc", () => {
  it("formats a UTC datetime without the UTC suffix", () => {
    const formatted = formatShortDateTimeUtc("2026-06-16T17:30:00.000Z");
    expect(formatted).toContain("Jun");
    expect(formatted).toContain("16");
    expect(formatted.toLowerCase()).not.toContain("utc");
  });

  it("returns empty string for invalid input", () => {
    expect(formatShortDateTimeUtc("not-a-date")).toBe("");
  });
});

describe("isCompleteDateInput", () => {
  it("accepts finished dates and rejects partial years or empty input", () => {
    expect(isCompleteDateInput("2026-11-05")).toBe(true);
    for (const partial of ["0002-11-05", "0020-11-05", "0202-11-05", "", "2026-11"]) {
      expect(isCompleteDateInput(partial)).toBe(false);
    }
  });
});
