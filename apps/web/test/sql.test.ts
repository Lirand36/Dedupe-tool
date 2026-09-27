import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = join(import.meta.dirname, "../src/lib");

describe("SQL parameters", () => {
  it("never casts a parameter straight to jsonb (the Postgres driver would JSON-encode it twice)", () => {
    const offenders = readdirSync(LIB)
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) =>
        readFileSync(join(LIB, f), "utf8")
          .split("\n")
          .map((line, i) => ({ where: `${f}:${i + 1}`, line }))
          .filter(({ line }) => /\$\d+::jsonb/.test(line)),
      )
      .map(({ where }) => where);
    expect(offenders).toEqual([]);
  });
});
