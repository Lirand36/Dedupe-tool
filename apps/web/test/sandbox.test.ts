import type { RunConfig } from "@dedupe/core";
import { describe, expect, it } from "vitest";
import { simulateMerge } from "../src/lib/sandbox";

const config: RunConfig = {
  policy: { channels: [], fields: { title: { kind: "current" } } },
  match: { entity: "person", fields: { email: "email" }, thresholds: { auto: 0.95, review: 0.75 } },
};
const rows = [
  {
    id: "A",
    createdAt: "2023-01-01",
    updatedAt: "2023-01-01",
    cells: { email: "d@acme.com", title: "Manager" },
  },
  {
    id: "B",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    cells: { email: "d@acme.com", title: "VP" },
  },
];

describe("simulateMerge", () => {
  it("shows how the chosen records would match and what would survive", () => {
    const result = simulateMerge(rows, ["email", "title"], config);
    expect(result.pairs).toEqual([
      expect.objectContaining({ a: "A", b: "B", verdict: "auto", reason: "Same email" }),
    ]);
    const title = result.rows.find((r) => r.field === "title");
    expect(title?.clean?.text).toBe("VP");
    expect(result.recordIds).toEqual(["A", "B"]);
  });
});
