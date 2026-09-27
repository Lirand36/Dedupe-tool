import type { Policy } from "@dedupe/core";
import { describe, expect, it } from "vitest";
import { buildComparison, groupLabel, valueText } from "../src/lib/views";

const records = [
  {
    id: "A",
    createdAt: "2023-01-01",
    updatedAt: "2023-01-01",
    cells: { title: "Manager", notes: "x" },
  },
  { id: "B", createdAt: "2025-01-01", updatedAt: "2025-01-01", cells: { title: "VP", notes: "" } },
];
const policy: Policy = { channels: [], fields: { title: { kind: "current" } } };
const golden = {
  values: { title: "VP" },
  reasons: { title: { text: "Current: latest value (2025-01-01)", sourceId: "B" } },
};

describe("buildComparison", () => {
  it("puts tagged fields first and marks the winning record", () => {
    const rows = buildComparison(records, ["notes", "title"], policy, golden, {});
    expect(rows.map((r) => r.field)).toEqual(["title", "notes"]);
    expect(rows[0]?.cells.map((c) => c.isWinner)).toEqual([false, true]);
    expect(rows[0]?.clean).toEqual({
      text: "VP",
      reason: "Current: latest value (2025-01-01)",
      overridden: false,
    });
    expect(rows[1]).toMatchObject({ tagged: false, clean: null });
    expect(rows[1]?.cells.every((c) => !c.isWinner)).toBe(true);
  });

  it("shows a person's choice as the clean value", () => {
    const [title] = buildComparison(records, ["title"], policy, golden, { title: "Manager" });
    expect(title?.clean).toEqual({ text: "Manager", reason: "Chosen by you", overridden: true });
    expect(title?.cells.map((c) => c.isWinner)).toEqual([true, false]);
  });
});

describe("groupLabel", () => {
  const record = {
    id: "A",
    createdAt: "",
    updatedAt: "",
    cells: { f: "Dana", l: "Levi", e: "d@x.com", c: "Acme" },
  };

  it("prefers a name, then email, then company, then the id", () => {
    expect(groupLabel(record, { firstName: "f", lastName: "l" })).toBe("Dana Levi");
    expect(groupLabel(record, { email: "e" })).toBe("d@x.com");
    expect(groupLabel(record, { company: "c" })).toBe("Acme");
    expect(groupLabel(record, {})).toBe("A");
    expect(groupLabel(undefined, {})).toBe("Unknown");
  });
});

describe("valueText", () => {
  it("formats empty, list and scalar values", () => {
    expect(valueText(null)).toBe("");
    expect(valueText(undefined)).toBe("");
    expect(valueText(["a", "b"])).toBe("a; b");
    expect(valueText(3)).toBe("3");
  });
});
