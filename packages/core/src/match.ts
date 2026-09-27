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

/** Joins strongest links first, so each group's confidence is its weakest necessary link. */
function cluster(edges: readonly Evidence[], auto: number): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const links: Evidence[] = [];
  for (const edge of [...edges].sort(compareEvidence)) {
    const [ra, rb] = [find(edge.a), find(edge.b)];
    if (ra === rb) continue;
    parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
    links.push(edge);
  }
  const byRoot = new Map<string, Evidence[]>();
  for (const link of links) byRoot.set(find(link.a), [...(byRoot.get(find(link.a)) ?? []), link]);
  return [...byRoot.values()]
    .map((evidence) => {
      const ids = [...new Set(evidence.flatMap((e) => [e.a, e.b]))].sort();
      const confidence = Math.round(Math.min(...evidence.map((e) => e.score)) * 1000) / 1000;
      return { ids, confidence, tier: confidence >= auto ? "auto" : "review", evidence } as const;
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
    if (score < config.thresholds.review) return [];
    const [first, second] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    return [{ a: first, b: second, score, reason }];
  });
  return cluster(edges, config.thresholds.auto);
}
