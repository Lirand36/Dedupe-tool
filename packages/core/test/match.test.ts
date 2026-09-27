import { describe, expect, it } from "vitest";
import { findDuplicates, type MatchConfig } from "../src/match";
import { makeRecord } from "./fixtures";

const T = "2024-01-01T00:00:00Z";

const personConfig: MatchConfig = {
  entity: "person",
  fields: {
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    company: "company",
  },
  thresholds: { auto: 0.95, review: 0.75 },
  defaultCountry: "US",
};

const companyConfig: MatchConfig = {
  entity: "company",
  fields: { company: "name", website: "website", phone: "phone" },
  thresholds: { auto: 0.95, review: 0.75 },
};

function person(id: string, fields: Record<string, string | null>) {
  return makeRecord(id, T, T, fields);
}

describe("findDuplicates: people", () => {
  it("auto-merges the same email regardless of case", () => {
    const groups = findDuplicates(
      [
        person("a", { email: "Dana@Acme.com", firstName: "Dana" }),
        person("b", { email: "dana@acme.com ", firstName: "Dana" }),
      ],
      personConfig,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ ids: ["a", "b"], tier: "auto", confidence: 1 });
    expect(groups[0]?.evidence[0]?.reason).toMatch(/same email/i);
  });

  it("sends similar names at the same company domain to review", () => {
    const groups = findDuplicates(
      [
        person("a", { email: "jon@acme.com", firstName: "Jon", lastName: "Smith" }),
        person("b", { email: "jsmith@acme.com", firstName: "Jonathan", lastName: "Smith" }),
      ],
      personConfig,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tier).toBe("review");
  });

  it("does not match same-name people who only share a free email domain", () => {
    const groups = findDuplicates(
      [
        person("a", { email: "alex@gmail.com", firstName: "Alex", lastName: "Kim" }),
        person("b", { email: "akim99@gmail.com", firstName: "Alex", lastName: "Kim" }),
      ],
      personConfig,
    );
    expect(groups).toEqual([]);
  });

  it("sends the same phone with a similar name to review, never auto", () => {
    const groups = findDuplicates(
      [
        person("a", { phone: "(415) 555-2671", firstName: "Dana", lastName: "Levi" }),
        person("b", { phone: "+1 415 555 2671", firstName: "Dana", lastName: "Levy" }),
      ],
      personConfig,
    );
    expect(groups[0]?.tier).toBe("review");
  });

  it("does not auto-merge colleagues who share a switchboard number", () => {
    const groups = findDuplicates(
      [
        person("a", {
          phone: "+1 415 555 2671",
          firstName: "Michael",
          lastName: "Johnson",
          company: "Acme",
        }),
        person("b", {
          phone: "+1 415 555 2671",
          firstName: "Michael",
          lastName: "Johnston",
          company: "Acme",
        }),
      ],
      personConfig,
    );
    expect(groups.every((g) => g.tier === "review")).toBe(true);
  });

  it("downgrades a chained group when two members contradict each other", () => {
    const groups = findDuplicates(
      [
        person("a", {
          email: "sam@acme.com",
          firstName: "Sam",
          lastName: "Cohen",
          phone: "+1 415 555 2671",
        }),
        person("b", { email: "sam@acme.com", firstName: "Sam", lastName: "Cohen" }),
        person("c", {
          email: "sam.c@acme.com",
          firstName: "Samantha",
          lastName: "Cohen",
          phone: "+1 415 555 2671",
        }),
        person("d", {
          email: "sam@acme.com",
          firstName: "Rita",
          lastName: "Gold",
          phone: "+1 415 555 2671",
        }),
      ],
      { ...personConfig, thresholds: { auto: 0.8, review: 0.75 } },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tier).toBe("review");
    expect(groups[0]?.confidence).toBeLessThan(0.75);
    expect(groups[0]?.evidence.some((e) => /conflict/i.test(e.reason))).toBe(true);
  });

  it("chains matches into one group and reports the weakest link", () => {
    const groups = findDuplicates(
      [
        person("a", { email: "dana@acme.com", firstName: "Dana", lastName: "Levi" }),
        person("b", {
          email: "dana@acme.com",
          firstName: "Dana",
          lastName: "Levi",
          company: "Acme",
        }),
        person("c", {
          email: "dlevi@acme.com",
          firstName: "Dana",
          lastName: "Levi",
          company: "Acme Inc",
        }),
        person("z", { email: "someone@else.com", firstName: "Zed", lastName: "Other" }),
      ],
      personConfig,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.ids).toEqual(["a", "b", "c"]);
    expect(groups[0]?.tier).toBe("review");
    expect(groups[0]?.confidence).toBeLessThan(0.95);
  });

  it("returns nothing for unrelated people", () => {
    const groups = findDuplicates(
      [
        person("a", { email: "a@one.com", firstName: "Ann", lastName: "Lee" }),
        person("b", { email: "b@two.com", firstName: "Bob", lastName: "Ray" }),
      ],
      personConfig,
    );
    expect(groups).toEqual([]);
  });
});

describe("findDuplicates: companies", () => {
  it("auto-merges companies with the same website domain", () => {
    const groups = findDuplicates(
      [
        person("a", { name: "Acme, Inc.", website: "acme.com" }),
        person("b", { name: "ACME Corporation", website: "https://www.acme.com/about" }),
      ],
      companyConfig,
    );
    expect(groups[0]).toMatchObject({ ids: ["a", "b"], tier: "auto" });
  });

  it("sends identical names without a website to review", () => {
    const groups = findDuplicates(
      [person("a", { name: "Acme Corp" }), person("b", { name: "Acme Inc" })],
      companyConfig,
    );
    expect(groups[0]).toMatchObject({ ids: ["a", "b"], tier: "review" });
  });

  it("uses a shared phone to confirm a similar name", () => {
    const groups = findDuplicates(
      [
        person("a", { name: "Globex Systems", phone: "+1 415 555 2671" }),
        person("b", { name: "Globex Sys", phone: "4155552671" }),
      ],
      { ...companyConfig, defaultCountry: "US" },
    );
    expect(groups).toHaveLength(1);
  });

  it("keeps different companies apart", () => {
    const groups = findDuplicates(
      [
        person("a", { name: "Acme", website: "acme.com" }),
        person("b", { name: "Initech", website: "initech.com" }),
      ],
      companyConfig,
    );
    expect(groups).toEqual([]);
  });
});
