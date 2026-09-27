import { describe, expect, it } from "vitest";
import type { RunConfig } from "../src/config";
import { applyTemplate, RULE_TEMPLATES } from "../src/templates";

const columns = [
  "leadSource",
  "originalForm",
  "utmCampaign",
  "sdrOwner",
  "sequence",
  "title",
  "email",
];

const base: RunConfig = {
  policy: { channels: [], fields: { title: { kind: "origin" } } },
  match: { entity: "person", fields: { email: "email" }, thresholds: { auto: 0.95, review: 0.75 } },
};

describe("rule templates", () => {
  it("lists templates with a name and a description", () => {
    expect(RULE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const t of RULE_TEMPLATES) expect(t.name && t.description).toBeTruthy();
  });

  it("inbound vs outbound: builds channels from the real source values and routes fields", () => {
    const { config, changes } = applyTemplate(base, "inbound-outbound", columns, {
      leadSource: ["Web Form", "Webinar", "Cold Call", "Outbound", "Partner"],
    });
    expect(config.policy.channels).toEqual([
      {
        name: "inbound",
        when: [{ field: "leadSource", op: "in", values: ["Web Form", "Webinar"] }],
      },
      {
        name: "outbound",
        when: [{ field: "leadSource", op: "in", values: ["Cold Call", "Outbound"] }],
      },
    ]);
    expect(config.policy.fields).toMatchObject({
      leadSource: { kind: "origin" },
      originalForm: { kind: "channel", channel: "inbound", pick: "earliest" },
      utmCampaign: { kind: "channel", channel: "inbound", pick: "earliest" },
      sdrOwner: { kind: "channel", channel: "outbound", pick: "latest" },
      sequence: { kind: "channel", channel: "outbound", pick: "latest" },
      title: { kind: "origin" },
    });
    expect(changes.join(" ")).toMatch(/Partner/);
    expect(base.policy.channels).toEqual([]);
  });

  it("inbound vs outbound: never routes name fields, even when they start with 'first'", () => {
    const cols = ["LeadSource", "FirstName", "First_Name", "First_Touch_Date__c"];
    const { config } = applyTemplate(base, "inbound-outbound", cols, { LeadSource: ["Web"] });
    expect(config.policy.fields.FirstName).toBeUndefined();
    expect(config.policy.fields.First_Name).toBeUndefined();
    expect(config.policy.fields.First_Touch_Date__c).toMatchObject({
      kind: "channel",
      channel: "inbound",
    });
  });

  it("inbound vs outbound: explains when there is no source field", () => {
    const { config, changes } = applyTemplate(base, "inbound-outbound", ["email", "title"], {});
    expect(config).toEqual(base);
    expect(changes[0]).toMatch(/No lead source field/);
  });

  it("lifecycle never goes backwards: orders stages it recognises", () => {
    const { config, changes } = applyTemplate(base, "lifecycle-forward", ["lifecycleStage"], {
      lifecycleStage: ["MQL", "Customer", "Weird", "SQL", "Lead"],
    });
    expect(config.policy.fields.lifecycleStage).toEqual({
      kind: "strongest",
      ranking: ["Customer", "SQL", "MQL", "Lead", "Weird"],
    });
    expect(changes.join(" ")).toMatch(/Weird/);
  });

  it("newest contact info and keep every value tag the right fields", () => {
    const cols = ["email", "Mobile Phone", "title", "interests", "tags", "notes"];
    const newest = applyTemplate(base, "newest-contact-info", cols, {}).config.policy.fields;
    expect(newest).toMatchObject({
      email: { kind: "current" },
      "Mobile Phone": { kind: "current" },
      title: { kind: "current" },
    });
    expect(newest.notes).toBeUndefined();
    const combined = applyTemplate(base, "combine-multi-value", cols, {}).config.policy.fields;
    expect(combined).toMatchObject({ interests: { kind: "combine" }, tags: { kind: "combine" } });
  });

  it("rejects unknown templates", () => {
    expect(() => applyTemplate(base, "nope", columns, {})).toThrow(/Unknown template/);
  });
});
