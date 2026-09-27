import { describe, expect, it } from "vitest";
import { candidatesFromRecord, mergeCandidates } from "../src/candidates";
import { classifyChannel } from "../src/channels";
import { resolveGolden } from "../src/resolve";
import type { Policy } from "../src/types";
import { inboundLead, makeRecord, outboundLead, revopsPolicy } from "./fixtures";

function goldenFor(policy: Policy, ...records: (typeof inboundLead)[]) {
  const merged = records
    .map((r) => candidatesFromRecord(r, policy))
    .reduce((a, b) => mergeCandidates(a, b));
  return resolveGolden(merged, policy);
}

describe("classifyChannel", () => {
  it("returns the first channel whose conditions all hold, case-insensitively", () => {
    const rec = makeRecord("r", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", {
      leadSource: "web form",
    });
    expect(classifyChannel(rec, revopsPolicy.channels)).toBe("inbound");
  });

  it("returns null when no channel matches", () => {
    const rec = makeRecord("r", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", {
      leadSource: "Partner",
    });
    expect(classifyChannel(rec, revopsPolicy.channels)).toBeNull();
  });

  it("supports notEmpty conditions", () => {
    const channels = [{ name: "sales", when: [{ field: "sdrOwner", op: "notEmpty" as const }] }];
    expect(classifyChannel(outboundLead, channels)).toBe("sales");
    expect(classifyChannel(inboundLead, channels)).toBeNull();
  });
});

describe("survivorship: inbound record from 2023 + outbound record from 2025", () => {
  const golden = goldenFor(revopsPolicy, inboundLead, outboundLead);

  it("keeps inbound attribution from the old inbound record", () => {
    expect(golden.values.leadSource).toBe("Web Form");
    expect(golden.values.originalForm).toBe("Pricing Demo");
    expect(golden.values.utmCampaign).toBe("q1-brand");
  });

  it("takes outbound fields from the newest outbound record", () => {
    expect(golden.values.sdrOwner).toBe("Sam SDR");
    expect(golden.values.sequence).toBe("Enterprise Q1");
  });

  it("keeps the current title, the strongest stage and all interests", () => {
    expect(golden.values.title).toBe("VP Marketing");
    expect(golden.values.lifecycleStage).toBe("SQL");
    expect(golden.values.interests).toEqual(["Analytics", "Integrations"]);
  });

  it("explains every value with its source record", () => {
    expect(golden.reasons.originalForm?.sourceId).toBe("lead-inbound");
    expect(golden.reasons.originalForm?.text).toMatch(/earliest inbound/i);
    expect(golden.reasons.title?.sourceId).toBe("lead-outbound");
    expect(golden.reasons.lifecycleStage?.text).toMatch(/highest-ranked/i);
  });

  it("gives the same answer regardless of merge order", () => {
    expect(goldenFor(revopsPolicy, outboundLead, inboundLead)).toEqual(golden);
  });
});

describe("candidates stay small", () => {
  it("ignores empty values and only keeps distinct values for strongest/combine fields", () => {
    const c = candidatesFromRecord(inboundLead, revopsPolicy);
    expect(c.fields.sdrOwner).toBeUndefined();
    expect(c.fields.title?.values).toBeUndefined();
    expect(c.fields.interests?.values).toHaveLength(1);
  });

  it("does not grow when the same value is seen again", () => {
    const again = { ...outboundLead, id: "lead-outbound-2", updatedAt: "2025-06-01T00:00:00Z" };
    const merged = [inboundLead, outboundLead, again]
      .map((r) => candidatesFromRecord(r, revopsPolicy))
      .reduce((a, b) => mergeCandidates(a, b));
    expect(merged.fields.interests?.values).toHaveLength(2);
    expect(merged.fields.lifecycleStage?.values).toHaveLength(2);
    expect(merged.sourceIds).toEqual(["lead-inbound", "lead-outbound", "lead-outbound-2"]);
  });

  it("prefers per-field timestamps over record timestamps", () => {
    const withHistory = {
      ...outboundLead,
      fieldTimestamps: { title: "2020-01-01T00:00:00Z" },
    };
    const golden = goldenFor(revopsPolicy, inboundLead, withHistory);
    expect(golden.values.title).toBe("Marketing Manager");
  });

  it("breaks timestamp ties deterministically by source id", () => {
    const a = makeRecord("a", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", { title: "A" });
    const b = makeRecord("b", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", { title: "B" });
    expect(goldenFor(revopsPolicy, a, b).values.title).toBe(
      goldenFor(revopsPolicy, b, a).values.title,
    );
  });
});

describe("resolveGolden edge cases", () => {
  it("returns null with a reason when a channel has no records", () => {
    const golden = goldenFor(revopsPolicy, inboundLead);
    expect(golden.values.sdrOwner).toBeNull();
    expect(golden.reasons.sdrOwner?.text).toMatch(/no outbound/i);
  });

  it("falls back to the latest value when no value is in the ranking", () => {
    const policy: Policy = {
      channels: [],
      fields: { lifecycleStage: { kind: "strongest", ranking: ["Customer"] } },
    };
    expect(goldenFor(policy, inboundLead, outboundLead).values.lifecycleStage).toBe("SQL");
  });

  it("can switch a field from current to origin without re-reading records", () => {
    const merged = mergeCandidates(
      candidatesFromRecord(inboundLead, revopsPolicy),
      candidatesFromRecord(outboundLead, revopsPolicy),
    );
    const retagged: Policy = {
      ...revopsPolicy,
      fields: { ...revopsPolicy.fields, title: { kind: "origin" } },
    };
    expect(resolveGolden(merged, retagged).values.title).toBe("Marketing Manager");
  });

  it("returns null for fields that were never populated", () => {
    const policy: Policy = { channels: [], fields: { phone: { kind: "current" } } };
    const golden = goldenFor(policy, inboundLead);
    expect(golden.values.phone).toBeNull();
    expect(golden.reasons.phone?.text).toMatch(/no value/i);
  });
});
