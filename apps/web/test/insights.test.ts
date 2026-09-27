import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  fillRates,
  healthSummary,
  isReadyToMerge,
  MINUTES_PER_MANUAL_MERGE,
} from "../src/lib/insights";
import { clientIp, createRateLimiter } from "../src/lib/rateLimit";
import { createSessionToken, passwordMatches, verifySessionToken } from "../src/lib/session";

const SECRET = "x".repeat(40);

describe("sessions", () => {
  it("accepts its own unexpired token", () => {
    expect(verifySessionToken(SECRET, createSessionToken(SECRET))).toBe(true);
  });

  it("rejects tampered, foreign, expired and missing tokens", () => {
    const token = createSessionToken(SECRET, 1_000);
    const [expires, sig] = token.split(".");
    expect(verifySessionToken(SECRET, `${Number(expires) + 1}.${sig}`, 1_000)).toBe(false);
    expect(verifySessionToken("y".repeat(40), token, 1_000)).toBe(false);
    expect(verifySessionToken(SECRET, token, Number(expires) + 1)).toBe(false);
    expect(verifySessionToken(SECRET, undefined)).toBe(false);
    expect(verifySessionToken(SECRET, "garbage")).toBe(false);
  });

  it("compares passwords exactly", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("correct horse", "correct hors")).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses the address the platform proxy appended, not one the client made up", () => {
    expect(clientIp("1.1.1.1, 2.2.2.2, 9.9.9.9")).toBe("9.9.9.9");
    expect(clientIp("9.9.9.9")).toBe("9.9.9.9");
    expect(clientIp(null)).toBe("unknown");
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and opens again after the window", () => {
    const limiter = createRateLimiter(2, 1_000);
    expect(limiter.attempt("ip", 0)).toBe(true);
    expect(limiter.attempt("ip", 10)).toBe(true);
    expect(limiter.attempt("ip", 20)).toBe(false);
    expect(limiter.attempt("other", 20)).toBe(true);
    expect(limiter.attempt("ip", 1_500)).toBe(true);
    limiter.reset("ip");
    expect(limiter.attempt("ip", 1_501)).toBe(true);
  });
});

describe("applyOverrides", () => {
  const golden = {
    values: { title: "VP", phone: "+1" },
    reasons: {
      title: { text: "Current: latest value (2025-01-01)", sourceId: "b" },
      phone: { text: "x" },
    },
  };

  it("replaces chosen values and says a person chose them", () => {
    const result = applyOverrides(golden, { title: "CMO" });
    expect(result.values).toEqual({ title: "CMO", phone: "+1" });
    expect(result.reasons.title?.text).toBe("Chosen by you");
    expect(golden.values.title).toBe("VP");
  });

  it("ignores overrides for fields outside the policy", () => {
    expect(applyOverrides(golden, { unknown: "x" }).values).toEqual(golden.values);
  });
});

describe("fillRates", () => {
  it("reports the share of non-empty cells per column, emptiest first", () => {
    const rows = [
      { cells: { a: "1", b: "" } },
      { cells: { a: "2", b: " " } },
      { cells: { a: "", b: "x" } },
    ];
    expect(fillRates(rows, ["a", "b"])).toEqual([
      { column: "b", filled: 1, rate: 1 / 3 },
      { column: "a", filled: 2, rate: 2 / 3 },
    ]);
    expect(fillRates([], ["a"])).toEqual([{ column: "a", filled: 0, rate: 0 }]);
  });
});

describe("healthSummary", () => {
  const groups = [
    { tier: "auto", decision: "pending", size: 2 },
    { tier: "auto", decision: "rejected", size: 2 },
    { tier: "review", decision: "pending", size: 3 },
    { tier: "review", decision: "merged", size: 2 },
  ] as const;

  it("counts what is ready, what waits for a person and the time saved", () => {
    expect(healthSummary(100, groups)).toEqual({
      records: 100,
      duplicateGroups: 4,
      duplicateRecords: 9,
      duplicateRate: 0.09,
      readyToMerge: 2,
      needsReview: 1,
      rejected: 1,
      recordsToRemove: 2,
      hoursSaved: (2 * MINUTES_PER_MANUAL_MERGE) / 60,
    });
  });

  it("handles an empty dataset", () => {
    expect(healthSummary(0, []).duplicateRate).toBe(0);
  });

  it("treats auto groups as ready unless rejected, review groups only once approved", () => {
    expect(isReadyToMerge({ tier: "auto", decision: "pending" })).toBe(true);
    expect(isReadyToMerge({ tier: "auto", decision: "rejected" })).toBe(false);
    expect(isReadyToMerge({ tier: "review", decision: "pending" })).toBe(false);
    expect(isReadyToMerge({ tier: "review", decision: "merged" })).toBe(true);
  });
});
