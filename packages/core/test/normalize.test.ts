import { describe, expect, it } from "vitest";
import {
  corporateDomain,
  emailDomain,
  normalizeCompanyName,
  normalizeDomain,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from "../src/normalize";
import { jaroWinkler } from "../src/similarity";

describe("normalizers", () => {
  it("normalizes emails and rejects junk", () => {
    expect(normalizeEmail("  Dana@ACME.com ")).toBe("dana@acme.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(emailDomain("dana@acme.com")).toBe("acme.com");
  });

  it("extracts a bare domain from any website format", () => {
    expect(normalizeDomain("https://www.Acme.com/about?x=1")).toBe("acme.com");
    expect(normalizeDomain("acme.com:8080")).toBe("acme.com");
    expect(normalizeDomain("n/a")).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
  });

  it("drops free email domains when looking for a company", () => {
    expect(corporateDomain("gmail.com")).toBeNull();
    expect(corporateDomain("acme.com")).toBe("acme.com");
    expect(corporateDomain(null)).toBeNull();
  });

  it("formats phones as E.164 and rejects junk", () => {
    expect(normalizePhone("(415) 555-2671", "US")).toBe("+14155552671");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("strips legal suffixes and punctuation from company names", () => {
    expect(normalizeCompanyName("Acme, Inc.")).toBe("acme");
    expect(normalizeCompanyName("The ACME Corporation")).toBe("acme");
    expect(normalizeCompanyName("Smith & Sons GmbH")).toBe("smith and sons");
    expect(normalizeCompanyName("  ")).toBeNull();
  });

  it("normalizes person names including accents", () => {
    expect(normalizePersonName("  José  O'Neil ")).toBe("jose o neil");
    expect(normalizePersonName(null)).toBeNull();
  });
});

describe("jaroWinkler", () => {
  it("scores identical strings 1 and unrelated strings low", () => {
    expect(jaroWinkler("martha", "martha")).toBe(1);
    expect(jaroWinkler("abc", "xyz")).toBe(0);
    expect(jaroWinkler("", "abc")).toBe(0);
  });

  it("rewards common prefixes", () => {
    expect(jaroWinkler("martha", "marhta")).toBeCloseTo(0.961, 3);
    expect(jaroWinkler("dixon", "dicksonx")).toBeCloseTo(0.813, 3);
  });
});
