import { describe, expect, it } from "vitest";
import { ConfigError, parseRunConfig } from "../src/config";
import { checkExamples, previewPolicyChange } from "../src/examples";
import { runPipeline } from "../src/pipeline";
import type { Policy } from "../src/types";
import { inboundLead, makeRecord, outboundLead, revopsPolicy } from "./fixtures";

const matchConfig = {
  entity: "person" as const,
  fields: { email: "email" },
  thresholds: { auto: 0.95, review: 0.75 },
};

describe("runPipeline", () => {
  const stranger = makeRecord("other", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", {
    email: "x@y.com",
  });
  const result = runPipeline([outboundLead, stranger, inboundLead], {
    policy: revopsPolicy,
    match: matchConfig,
  });

  it("builds one identity per duplicate group with a clean record", () => {
    expect(result.identities).toHaveLength(1);
    const identity = result.identities[0];
    expect(identity?.sourceIds).toEqual(["lead-inbound", "lead-outbound"]);
    expect(identity?.golden.values.originalForm).toBe("Pricing Demo");
    expect(identity?.golden.values.sdrOwner).toBe("Sam SDR");
  });

  it("keeps the oldest record by default and lists the rest for removal", () => {
    expect(result.identities[0]?.keepRecordId).toBe("lead-inbound");
    expect(result.identities[0]?.removeRecordIds).toEqual(["lead-outbound"]);
  });

  it("summarises the run", () => {
    expect(result.stats).toEqual({
      records: 3,
      duplicateGroups: 1,
      autoGroups: 1,
      reviewGroups: 0,
      recordsToRemove: 1,
    });
  });
});

describe("examples as tests", () => {
  const example = {
    name: "Dana: inbound 2023, cold call 2025",
    records: [inboundLead, outboundLead],
    expected: { originalForm: "Pricing Demo", title: "VP Marketing" },
  };

  it("passes when the policy produces the expected values", () => {
    expect(checkExamples([example], revopsPolicy)).toEqual([]);
  });

  it("reports each field the policy gets wrong", () => {
    const broken: Policy = {
      ...revopsPolicy,
      fields: { ...revopsPolicy.fields, title: { kind: "origin" } },
    };
    expect(checkExamples([example], broken)).toEqual([
      {
        example: example.name,
        field: "title",
        expected: "VP Marketing",
        actual: "Marketing Manager",
      },
    ]);
  });

  it("previews what a policy change would change before it goes live", () => {
    const after: Policy = {
      ...revopsPolicy,
      fields: { ...revopsPolicy.fields, title: { kind: "origin" } },
    };
    const preview = previewPolicyChange([[inboundLead, outboundLead]], revopsPolicy, after);
    expect(preview.changedGroups).toBe(1);
    expect(preview.byField).toEqual({ title: 1 });
    expect(preview.samples[0]).toMatchObject({
      field: "title",
      before: "VP Marketing",
      after: "Marketing Manager",
    });
  });
});

describe("parseRunConfig", () => {
  const valid = { policy: revopsPolicy, match: matchConfig };

  it("accepts a valid config", () => {
    expect(parseRunConfig(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it("explains every problem in plain words", () => {
    const bad = {
      policy: {
        channels: [],
        fields: { sdrOwner: { kind: "channel", channel: "outbound", pick: "latest" } },
      },
      match: { ...matchConfig, thresholds: { auto: 0.5, review: 0.9 } },
    };
    expect(() => parseRunConfig(bad)).toThrow(ConfigError);
    try {
      parseRunConfig(bad);
    } catch (error) {
      const message = (error as ConfigError).message;
      expect(message).toMatch(/sdrOwner.*unknown channel "outbound"/);
      expect(message).toMatch(/review threshold must not be higher than auto/);
    }
  });

  it("rejects unknown tag kinds", () => {
    const bad = { ...valid, policy: { channels: [], fields: { x: { kind: "magic" } } } };
    expect(() => parseRunConfig(bad)).toThrow(/policy\.fields\.x/);
  });
});
