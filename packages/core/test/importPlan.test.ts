import { describe, expect, it } from "vitest";
import type { RunConfig } from "../src/config";
import { planImport } from "../src/importPlan";
import { runPipeline } from "../src/pipeline";
import type { SourceRecord } from "../src/types";

const config: RunConfig = {
  policy: {
    channels: [],
    fields: { LeadSource: { kind: "origin" }, Title: { kind: "current" } },
  },
  match: { entity: "person", fields: { email: "Email" }, thresholds: { auto: 0.95, review: 0.75 } },
};

const UPLOAD = "2026-09-27T12:00:00Z";
const rec = (id: string, at: string, fields: Record<string, string | null>): SourceRecord => ({
  id,
  system: "test",
  createdAt: at,
  updatedAt: at,
  fields,
});

// Existing CRM records (ids are Salesforce Ids) and rows from the file being imported.
const crm = [
  rec("003AAA", "2023-01-01T00:00:00Z", {
    Email: "dana@acme.com",
    LeadSource: "Web Form",
    Title: "Manager",
    Notes: "vip",
  }),
  rec("003BBB", "2023-02-01T00:00:00Z", {
    Email: "solo@crm.com",
    LeadSource: "Partner",
    Title: "CTO",
    Notes: "",
  }),
  rec("003CCC", "2023-03-01T00:00:00Z", {
    Email: "solo@crm.com",
    LeadSource: "Partner",
    Title: "CTO",
    Notes: "",
  }),
];
const file = [
  rec("row-2", UPLOAD, {
    Email: "dana@acme.com",
    LeadSource: "Trade Show",
    Title: "VP Marketing",
    Notes: "met at booth",
  }),
  rec("row-3", UPLOAD, {
    Email: "new@lead.com",
    LeadSource: "Trade Show",
    Title: "Analyst",
    Notes: "",
  }),
  rec("row-4", UPLOAD, {
    Email: "NEW@lead.com",
    LeadSource: "Trade Show",
    Title: "Senior Analyst",
    Notes: "",
  }),
  rec("row-5", UPLOAD, {
    Email: "fresh@one.com",
    LeadSource: "Trade Show",
    Title: "Founder",
    Notes: "",
  }),
];

function plan(ready: (sourceIds: readonly string[]) => boolean = () => true) {
  const all = [...crm, ...file];
  const result = runPipeline(all, config);
  return planImport({
    importRecords: file,
    crmRecords: crm,
    identities: result.identities.map((i) => ({
      sourceIds: i.sourceIds,
      golden: i.golden,
      ready: ready(i.sourceIds),
    })),
    fields: ["Email", "LeadSource", "Title", "Notes"],
  });
}

describe("planImport", () => {
  it("turns a row that already exists in the CRM into an update of that record", () => {
    const { updates } = plan();
    expect(updates).toEqual([
      {
        Id: "003AAA",
        Email: "dana@acme.com",
        LeadSource: "Web Form",
        Title: "VP Marketing",
        Notes: "vip",
        _source_rows: "row-2",
        _note: "",
      },
    ]);
  });

  it("merges duplicates inside the file into one insert and passes unique rows through", () => {
    const { inserts } = plan();
    expect(inserts.map((r) => r.Email)).toEqual(["new@lead.com", "fresh@one.com"]);
    expect(inserts[0]).toMatchObject({
      Id: "",
      Title: "Senior Analyst",
      _source_rows: "row-3; row-4",
    });
  });

  it("ignores duplicates that exist only in the CRM", () => {
    const { updates, inserts } = plan();
    expect([...updates, ...inserts].some((r) => r.Id === "003BBB" || r.Id === "003CCC")).toBe(
      false,
    );
  });

  it("does not merge groups that still wait for review", () => {
    const { inserts, stats } = plan((ids) => !ids.includes("row-3"));
    expect(inserts.map((r) => r._source_rows)).toEqual(["row-3", "row-4", "row-5"]);
    expect(stats.pendingReview).toBe(1);
  });

  it("summarises what happened to every row of the file", () => {
    expect(plan().stats).toEqual({
      fileRows: 4,
      inserts: 2,
      updates: 1,
      mergedInFile: 1,
      pendingReview: 0,
    });
  });
});
