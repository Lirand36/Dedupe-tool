import {
  blockKeys,
  buildProfile,
  type Entity,
  type MatchFields,
  type Profile,
  scorePair,
} from "./matchScore";
import type { SourceRecord } from "./types";

export type { Entity, MatchFields } from "./matchScore";

export interface MatchConfig {
  readonly entity: Entity;
  readonly fields: MatchFields;
  /** auto: merge without review. review: send to the Inbox. Below review: ignored. */
  readonly thresholds: { readonly auto: number; readonly review: number };
  /** ISO country used to read phone numbers without a country code. */
  readonly defaultCountry?: string;
}

export interface Evidence {
  readonly a: string;
  readonly b: string;
  readonly score: number;
  readonly reason: string;
}

export interface DuplicateGroup {
  readonly ids: readonly string[];
  /** The weakest link that holds the group together. */
  readonly confidence: number;
  readonly tier: "auto" | "review";
  readonly evidence: readonly Evidence[];
}

/** Fuzzy blocks larger than this are skipped: comparing every pair would be too slow and too noisy. */
export const MAX_FUZZY_BLOCK_SIZE = 200;

function groupBy(
  profiles: readonly Profile[],
  keysOf: (p: Profile) => string[],
): Map<string, number[]> {
  const blocks = new Map<string, number[]>();
  profiles.forEach((p, i) => {
    for (const key of keysOf(p)) blocks.set(key, [...(blocks.get(key) ?? []), i]);
  });
  return blocks;
}

function candidatePairs(profiles: readonly Profile[], entity: Entity): Array<[number, number]> {
  const seen = new Set<string>();
  const pairs: Array<[number, number]> = [];
  const add = (i: number, j: number) => {
    const key = `${i}:${j}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([i, j]);
  };
  // Exact keys match on their own, so chaining neighbours is enough to connect the whole block.
  for (const members of groupBy(profiles, (p) => blockKeys(p, entity).exact).values()) {
    for (let k = 1; k < members.length; k++) add(members[k - 1] as number, members[k] as number);
  }
  for (const members of groupBy(profiles, (p) => blockKeys(p, entity).fuzzy).values()) {
    if (members.length > MAX_FUZZY_BLOCK_SIZE) continue;
    for (let x = 0; x < members.length; x++) {
      for (let y = x + 1; y < members.length; y++) add(members[x] as number, members[y] as number);
    }
  }
  return pairs;
}

function compareEvidence(x: Evidence, y: Evidence): number {
  return y.score - x.score || x.a.localeCompare(y.a) || x.b.localeCompare(y.b);
}

function withinGroup(ids: ReadonlySet<string>, edges: readonly Evidence[]): Evidence[] {
  return edges.filter((e) => ids.has(e.a) && ids.has(e.b));
}

/**
 * Joins strongest links first. A group's confidence is its weakest necessary link, lowered further
 * by any pair inside the group that was compared and did not match (a conflict).
 */
function cluster(
  edges: readonly Evidence[],
  thresholds: MatchConfig["thresholds"],
): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const links: Evidence[] = [];
  const matches = edges.filter((e) => e.score >= thresholds.review).sort(compareEvidence);
  for (const edge of matches) {
    const [ra, rb] = [find(edge.a), find(edge.b)];
    if (ra === rb) continue;
    parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
    links.push(edge);
  }
  const byRoot = new Map<string, Evidence[]>();
  for (const link of links) byRoot.set(find(link.a), [...(byRoot.get(find(link.a)) ?? []), link]);
  const conflictsAll = edges
    .filter((e) => e.score < thresholds.review)
    .map((e) => ({ ...e, reason: `Conflict: ${e.reason}` }));
  return [...byRoot.values()]
    .map((groupLinks) => {
      const ids = [...new Set(groupLinks.flatMap((e) => [e.a, e.b]))].sort();
      const evidence = [...groupLinks, ...withinGroup(new Set(ids), conflictsAll)];
      const confidence = Math.round(Math.min(...evidence.map((e) => e.score)) * 1000) / 1000;
      const tier = confidence >= thresholds.auto ? "auto" : "review";
      return { ids, confidence, tier, evidence } as const;
    })
    .sort((x, y) => (x.ids[0] ?? "").localeCompare(y.ids[0] ?? ""));
}

export function findDuplicates(
  records: readonly SourceRecord[],
  config: MatchConfig,
): DuplicateGroup[] {
  const profiles = records.map((r) =>
    buildProfile(r, config.entity, config.fields, config.defaultCountry),
  );
  const edges = candidatePairs(profiles, config.entity).flatMap(([i, j]) => {
    const [a, b] = [profiles[i] as Profile, profiles[j] as Profile];
    const { score, reason } = scorePair(a, b, config.entity);
    const [first, second] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    return [{ a: first, b: second, score, reason }];
  });
  return cluster(edges, config.thresholds);
}

/** The sandbox compares every pair, so keep it to a handful of records. */
export const MAX_PAIRWISE_RECORDS = 10;

export interface PairExplanation extends Evidence {
  readonly verdict: "auto" | "review" | "none";
}

/** Scores every pair of a few records, including pairs that would not match, with the reason. */
export function scoreAllPairs(
  records: readonly SourceRecord[],
  config: MatchConfig,
): PairExplanation[] {
  if (records.length > MAX_PAIRWISE_RECORDS) {
    throw new Error(`Compare at most ${MAX_PAIRWISE_RECORDS} records at a time`);
  }
  const profiles = records.map((r) =>
    buildProfile(r, config.entity, config.fields, config.defaultCountry),
  );
  return profiles.flatMap((a, i) =>
    profiles.slice(i + 1).map((b) => {
      const { score, reason } = scorePair(a, b, config.entity);
      const verdict =
        score >= config.thresholds.auto
          ? "auto"
          : score >= config.thresholds.review
            ? "review"
            : "none";
      return { a: a.id, b: b.id, score, reason, verdict } as const;
    }),
  );
}
