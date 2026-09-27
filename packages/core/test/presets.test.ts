import { describe, expect, it } from "vitest";
import { draftConfig, getPreset, normalizeFieldName, OBJECT_PRESETS } from "../src/presets";

describe("object presets", () => {
  it("covers the main CRM objects with unique ids", () => {
    const ids = OBJECT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "salesforce.lead",
        "salesforce.contact",
        "salesforce.account",
        "hubspot.contact",
        "hubspot.company",
        "other.person",
        "other.company",
      ]),
    );
    expect(getPreset("salesforce.account")?.entity).toBe("company");
    expect(getPreset("nope")).toBeUndefined();
  });

  it("normalizes API and label style field names alike", () => {
    expect(normalizeFieldName("Lead_Source__c")).toBe("leadsource");
    expect(normalizeFieldName("First Name")).toBe("firstname");
    expect(normalizeFieldName("hs_analytics_source")).toBe("hsanalyticssource");
  });
});

describe("draftConfig", () => {
  it("maps standard Salesforce Contact fields and marks where each tag came from", () => {
    const { config, suggestions } = draftConfig(
      ["Email", "FirstName", "LastName", "Phone", "AccountName", "LeadSource", "Title", "Score__c"],
      "salesforce.contact",
    );
    expect(config.match).toMatchObject({
      entity: "person",
      fields: {
        email: "Email",
        firstName: "FirstName",
        lastName: "LastName",
        phone: "Phone",
        company: "AccountName",
      },
    });
    expect(config.policy.fields.LeadSource).toEqual({ kind: "origin" });
    expect(suggestions.LeadSource?.source).toBe("preset");
    expect(suggestions.Score__c?.source).toBe("default");
  });

  it("knows HubSpot lifecycle stages and their order", () => {
    const { config } = draftConfig(
      ["email", "firstname", "lastname", "lifecyclestage"],
      "hubspot.contact",
    );
    const stage = config.policy.fields.lifecyclestage;
    expect(stage?.kind).toBe("strongest");
    expect(stage?.kind === "strongest" && stage.ranking.slice(0, 3)).toEqual([
      "evangelist",
      "customer",
      "opportunity",
    ]);
    expect(config.match.fields).toMatchObject({ email: "email", firstName: "firstname" });
  });

  it("treats Name as the company name on company objects", () => {
    const { config } = draftConfig(["Name", "Website", "Phone", "Type"], "salesforce.account");
    expect(config.match).toMatchObject({
      entity: "company",
      fields: { company: "Name", website: "Website", phone: "Phone" },
    });
  });

  it("throws on an unknown object", () => {
    expect(() => draftConfig(["Email"], "nope")).toThrow(/Unknown object/);
  });
});
