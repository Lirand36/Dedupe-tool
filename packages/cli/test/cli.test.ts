import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Policy } from "@dedupe/core";
import { parse } from "csv-parse/sync";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCommand, suggestCommand } from "../src/commands";
import { CsvError, mapRows, recordsFromCsv, safeCell } from "../src/csv";
import { suggestConfig } from "../src/suggestConfig";

const EXAMPLES = join(import.meta.dirname, "../../../examples");
const policy: Policy = { channels: [], fields: { interests: { kind: "combine" } } };

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "dedupe-cli-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("recordsFromCsv", () => {
  it("reads rows, turns blanks into null and splits multi-value cells", () => {
    const [record] = recordsFromCsv(
      "id,createdAt,updatedAt,title,interests\nA,2024-01-01,2024-02-01,,Analytics; Integrations\n",
      policy,
    );
    expect(record).toMatchObject({
      id: "A",
      system: "csv",
      fields: { title: null, interests: ["Analytics", "Integrations"] },
    });
  });

  it.each([
    ["id,title\nA,x\n", /Missing required column\(s\): createdAt, updatedAt/],
    ["id,createdAt,updatedAt\n,2024-01-01,2024-01-01\n", /Row 2: "id" is empty/],
    ["id,createdAt,updatedAt\nA,yesterday,2024-01-01\n", /Row 2: "createdAt" must be an ISO date/],
    ["id,createdAt,updatedAt\nA,03/04/2023,2024-01-01\n", /Row 2: "createdAt" must be an ISO date/],
    [
      "id,createdAt,updatedAt\nA,2024-01-01,2024-01-01\nA,2024-01-01,2024-01-01\n",
      /Row 3: duplicate id "A"/,
    ],
  ])("rejects bad input with a clear message (%#)", (csv, message) => {
    expect(() => recordsFromCsv(csv, policy)).toThrow(CsvError);
    expect(() => recordsFromCsv(csv, policy)).toThrow(message);
  });
});

describe("safeCell", () => {
  it.each([
    ['=HYPERLINK("http://evil","x")', `'=HYPERLINK("http://evil","x")`],
    ["+1 415 555 2671", "'+1 415 555 2671"],
    ["-5", "'-5"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ["Dana", "Dana"],
    ["", ""],
  ])("neutralises spreadsheet formulas: %j", (input, expected) => {
    expect(safeCell(input)).toBe(expected);
  });
});

describe("suggestConfig", () => {
  it("tags fields and guesses which columns to match on", () => {
    const { config, rows } = suggestConfig([
      "id",
      "createdAt",
      "updatedAt",
      "Email",
      "First Name",
      "Last_Name",
      "Company",
      "First_Inbound_Date__c",
    ]);
    expect(config.match.fields).toEqual({
      email: "Email",
      firstName: "First Name",
      lastName: "Last_Name",
      company: "Company",
    });
    expect(config.policy.fields.First_Inbound_Date__c).toEqual({ kind: "origin" });
    expect(rows.map((r) => r.field)).not.toContain("id");
  });
});

describe("dedupe run on the example data", () => {
  it("merges the right people and keeps the right values", async () => {
    const out = join(dir, "clean.csv");
    const report = join(dir, "report.json");
    const stats = await runCommand({
      input: join(EXAMPLES, "contacts.csv"),
      config: join(EXAMPLES, "config.json"),
      out,
      report,
    });
    expect(stats).toEqual({
      records: 9,
      duplicateGroups: 3,
      autoGroups: 1,
      reviewGroups: 2,
      recordsToRemove: 3,
    });

    const rows = parse(await readFile(out, "utf8"), { columns: true }) as Record<string, string>[];
    const dana = rows.find((r) => r.keep_record_id === "L-001");
    expect(dana).toMatchObject({
      tier: "auto",
      leadSource: "Web Form",
      originalForm: "Pricing Demo",
      sdrOwner: "Sam SDR",
      title: "VP Marketing",
      lifecycleStage: "SQL",
      interests: "Analytics; Integrations",
    });
    expect(dana?.originalForm__why).toMatch(/Earliest inbound value \(2023-03-01\)/);

    const jon = rows.find((r) => r.keep_record_id === "L-003");
    expect(jon).toMatchObject({ tier: "review", remove_record_ids: "L-004" });

    const priya = rows.find((r) => r.keep_record_id === "L-007");
    expect(priya).toMatchObject({
      tier: "review",
      lifecycleStage: "Customer",
      originalForm: "Security Webinar",
    });

    expect(JSON.parse(await readFile(report, "utf8")).stats.records).toBe(9);
  });

  it("explains a broken config instead of crashing", async () => {
    const config = join(dir, "bad.json");
    await writeFile(config, "{ not json");
    await expect(
      runCommand({ input: join(EXAMPLES, "contacts.csv"), config, out: join(dir, "x.csv") }),
    ).rejects.toThrow(/bad\.json is not valid JSON/);
  });

  it("drafts a config from a CSV", async () => {
    const out = join(dir, "draft.json");
    const rows = await suggestCommand({ input: join(EXAMPLES, "contacts.csv"), out });
    const draft = JSON.parse(await readFile(out, "utf8"));
    expect(draft.policy.fields.leadSource).toEqual({ kind: "origin" });
    expect(draft.match.fields.email).toBe("email");
    expect(rows.find((r) => r.field === "lifecycleStage")?.tag).toBe("strongest");
  });
});

describe("mapRows", () => {
  const headers = ["Record ID", "E-mail", "Created", "Junk"];
  const rows = [
    { "Record ID": "A1", "E-mail": "a@x.com", Created: "2024-01-01", Junk: "x" },
    { "Record ID": "", "E-mail": "b@x.com", Created: "", Junk: "y" },
  ];

  it("renames columns, drops skipped ones and fills missing ids and dates", () => {
    const records = mapRows(
      headers,
      rows,
      {
        fields: { "E-mail": "Email", Junk: null },
        id: "Record ID",
        createdAt: "Created",
      },
      "2026-09-27T12:00:00Z",
    );
    expect(records).toEqual([
      { id: "A1", createdAt: "2024-01-01", updatedAt: "2024-01-01", cells: { Email: "a@x.com" } },
      {
        id: "row-3",
        createdAt: "2026-09-27T12:00:00Z",
        updatedAt: "2026-09-27T12:00:00Z",
        cells: { Email: "b@x.com" },
      },
    ]);
  });

  it("uses row numbers when there is no id column", () => {
    const [first] = mapRows(
      ["E-mail"],
      [{ "E-mail": "a@x.com" }],
      { fields: { "E-mail": "Email" } },
      "2026-09-27T12:00:00Z",
    );
    expect(first?.id).toBe("row-2");
  });

  it.each([
    [
      { ...rows[0], "Record ID": "A2", Created: "03/04/2024" },
      /Row 3: "Created" must be an ISO date/,
    ],
    [{ ...rows[0], "Record ID": "A1" }, /Row 3: duplicate id "A1"/],
  ])("rejects bad rows with a clear message (%#)", (second, message) => {
    expect(() =>
      mapRows(
        headers,
        [rows[0] as Record<string, string>, second as Record<string, string>],
        { fields: {}, id: "Record ID", createdAt: "Created" },
        "2026-09-27T12:00:00Z",
      ),
    ).toThrow(message);
  });
});
