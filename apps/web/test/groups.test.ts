import { describe, expect, it } from "vitest";
import { duplicateStats, mergePlanRows, nextRun, statusOf } from "../src/lib/groups";

describe("statusOf", () => {
  it.each([
    [{ tier: "auto", decision: "pending" }, "ready"],
    [{ tier: "review", decision: "pending" }, "review"],
    [{ tier: "review", decision: "approved" }, "ready"],
    [{ tier: "auto", decision: "merged" }, "merged"],
    [{ tier: "auto", decision: "rejected" }, "rejected"],
  ] as const)("%j is %s", (group, status) => {
    expect(statusOf(group)).toBe(status);
  });
});

describe("duplicateStats", () => {
  const groups = [
    { tier: "auto", decision: "pending", size: 2, reasons: ["Same email"] },
    { tier: "auto", decision: "pending", size: 3, reasons: ["Same email", "Same email"] },
    { tier: "review", decision: "pending", size: 2, reasons: ["Same phone, similar name"] },
    {
      tier: "review",
      decision: "rejected",
      size: 6,
      reasons: ["Conflict: No strong signal", "Similar name at the same company"],
    },
  ] as const;

  it("summarises what was found before anyone acts", () => {
    expect(duplicateStats(groups, 100)).toEqual({
      groups: 4,
      recordsInvolved: 13,
      shareOfObject: 0.13,
      recordsToRemove: 4,
      byStatus: { ready: 2, review: 1, merged: 0, rejected: 1 },
      bySize: [
        { label: "2", count: 2 },
        { label: "3", count: 1 },
        { label: "4", count: 0 },
        { label: "5+", count: 1 },
      ],
      byReason: [
        { label: "Same email", count: 2 },
        { label: "Same phone, similar name", count: 1 },
        { label: "Similar name at the same company", count: 1 },
      ],
    });
  });

  it("handles an object without duplicates", () => {
    expect(duplicateStats([], 0)).toMatchObject({
      groups: 0,
      shareOfObject: 0,
      recordsToRemove: 0,
    });
  });
});

describe("nextRun", () => {
  const now = new Date("2026-09-27T10:00:00Z"); // a Sunday

  it("returns null when the schedule is off", () => {
    expect(nextRun({ enabled: false, frequency: "daily", time: "02:00" }, now)).toBeNull();
  });

  it("finds the next daily run, today or tomorrow (UTC)", () => {
    expect(nextRun({ enabled: true, frequency: "daily", time: "02:00" }, now)?.toISOString()).toBe(
      "2026-09-28T02:00:00.000Z",
    );
    expect(nextRun({ enabled: true, frequency: "daily", time: "11:30" }, now)?.toISOString()).toBe(
      "2026-09-27T11:30:00.000Z",
    );
  });

  it("finds the next weekly run on the chosen weekday", () => {
    const monday = { enabled: true, frequency: "weekly", time: "02:00", weekday: 1 } as const;
    expect(nextRun(monday, now)?.toISOString()).toBe("2026-09-28T02:00:00.000Z");
    const sundayEarly = { enabled: true, frequency: "weekly", time: "02:00", weekday: 0 } as const;
    expect(nextRun(sundayEarly, now)?.toISOString()).toBe("2026-10-04T02:00:00.000Z");
  });
});

describe("mergePlanRows", () => {
  it("lists master, merged ids and the values to set, overrides first then rules then master", () => {
    const rows = mergePlanRows(
      [
        {
          sourceIds: ["crm:A", "crm:B"],
          masterId: "crm:A",
          golden: { values: { Title: "VP" }, reasons: {} },
          overrides: { Notes: "keep me" },
        },
      ],
      new Map([
        ["crm:A", { Title: "Manager", Notes: "old", Email: "a@x.com" }],
        ["crm:B", { Title: "VP", Notes: "", Email: "a@x.com" }],
      ]),
      ["Email", "Title", "Notes"],
    );
    expect(rows).toEqual([
      { MasterId: "A", MergedIds: "B", Email: "a@x.com", Title: "VP", Notes: "keep me" },
    ]);
  });
});
