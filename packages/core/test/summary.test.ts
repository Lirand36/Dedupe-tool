import { describe, expect, it } from "vitest";
import type { RunConfig } from "../src/config";
import { diffConfigs, summarizeLogic } from "../src/summary";
import { revopsPolicy } from "./fixtures";

const person: RunConfig = {
  policy: revopsPolicy,
  match: {
    entity: "person",
    fields: { email: "email", firstName: "firstName", lastName: "lastName", phone: "phone" },
    thresholds: { auto: 0.95, review: 0.75 },
  },
};

describe("summarizeLogic", () => {
  it("explains matching in plain words using the real thresholds", () => {
    const { matching } = summarizeLogic(person, []);
    expect(matching).toContain("Same email: merged automatically.");
    expect(matching).toContain("Same phone and a similar name: sent to review.");
    expect(matching.join(" ")).toMatch(/gmail\.com/);
  });

  it("follows threshold changes", () => {
    const lax = { ...person, match: { ...person.match, thresholds: { auto: 0.8, review: 0.75 } } };
    expect(summarizeLogic(lax, []).matching).toContain(
      "Same phone and a similar name: merged automatically.",
    );
  });

  it("says when a signal is not used", () => {
    const noPhone = { ...person, match: { ...person.match, fields: { email: "email" } } };
    expect(summarizeLogic(noPhone, []).matching.join(" ")).toMatch(/No phone column/);
  });

  it("groups surviving fields by what they mean", () => {
    const { groups, untagged } = summarizeLogic(person, ["title", "notes", "leadSource"]);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g]));
    expect(byLabel["First inbound"]?.fields).toEqual(["originalForm", "utmCampaign"]);
    expect(byLabel["Latest outbound"]?.sentence).toMatch(/latest outbound record/);
    expect(byLabel.Strongest?.sentence).toMatch(/Customer › SQL › MQL › Lead/);
    expect(byLabel.Origin?.fields).toEqual(["leadSource"]);
    expect(untagged).toEqual(["notes"]);
  });

  it("describes company matching", () => {
    const company: RunConfig = {
      policy: { channels: [], fields: {} },
      match: {
        entity: "company",
        fields: { company: "name", website: "site" },
        thresholds: { auto: 0.95, review: 0.75 },
      },
    };
    expect(summarizeLogic(company, []).matching).toContain(
      "Same website domain: merged automatically.",
    );
  });
});

describe("diffConfigs", () => {
  it("lists what changed in plain words", () => {
    const after: RunConfig = {
      policy: {
        ...person.policy,
        channels: person.policy.channels.filter((c) => c.name !== "outbound"),
        fields: { ...person.policy.fields, title: { kind: "origin" }, notes: { kind: "combine" } },
      },
      match: { ...person.match, thresholds: { auto: 0.9, review: 0.75 } },
    };
    const { interests: _removed, ...fieldsWithoutInterests } = after.policy.fields;
    const changes = diffConfigs(person, {
      ...after,
      policy: { ...after.policy, fields: fieldsWithoutInterests },
    });
    expect(changes).toEqual([
      "Removed channel outbound",
      "title: current → origin",
      "notes: now combine",
      "interests: no longer tagged",
      "Auto-merge threshold: 95% → 90%",
    ]);
    expect(diffConfigs(person, person)).toEqual([]);
  });
});
