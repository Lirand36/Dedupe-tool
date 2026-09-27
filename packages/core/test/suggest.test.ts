import { describe, expect, it } from "vitest";
import { suggestTag } from "../src/suggest";

describe("suggestTag", () => {
  it.each([
    ["First_Inbound_Date__c", "origin"],
    ["Original Source", "origin"],
    ["LeadSource", "origin"],
    ["utm_campaign", "origin"],
    ["Last_Activity_Date", "current"],
    ["Title", "current"],
    ["Lifecycle Stage", "strongest"],
    ["Lead_Status__c", "strongest"],
    ["Product_Interests__c", "combine"],
    ["tags", "combine"],
  ])("suggests %s -> %s", (field, kind) => {
    expect(suggestTag(field).tag.kind).toBe(kind);
  });

  it("marks name-based guesses as high confidence and defaults as low", () => {
    expect(suggestTag("First_Touch_Date").confidence).toBe("high");
    expect(suggestTag("Industry")).toMatchObject({ tag: { kind: "current" }, confidence: "low" });
  });
});
