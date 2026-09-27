import {
  corporateDomain,
  emailDomain,
  normalizeCompanyName,
  normalizeDomain,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
} from "./normalize";
import { jaroWinkler } from "./similarity";
import type { FieldValue, SourceRecord } from "./types";

export type Entity = "person" | "company";

/** Which record field holds each matching concept. Every entry is optional. */
export interface MatchFields {
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly fullName?: string;
  readonly phone?: string;
  readonly company?: string;
  readonly website?: string;
}

/** A record reduced to the comparison keys matching needs. */
export interface Profile {
  readonly id: string;
  readonly email: string | null;
  readonly domain: string | null;
  readonly name: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly company: string | null;
  readonly phone: string | null;
}

export interface PairScore {
  readonly score: number;
  readonly reason: string;
}

const SAME_EMAIL = 1;
/** Below any sensible auto threshold: colleagues often share a switchboard number. */
const SAME_PHONE_SIMILAR_NAME = 0.85;
/** Same email but clearly different names: a shared inbox or a reassigned address. */
const SAME_EMAIL_DIFFERENT_NAME = 0.8;
const MAX_CONFLICTING_NAME_SIMILARITY = 0.6;
const SAME_ORG_NAME_WEIGHT = 0.9;
const SIMILAR_ORG_NAME_WEIGHT = 0.8;
const MIN_PERSON_NAME_SIMILARITY = 0.85;
/** "Jon" vs "Jonathan": a first name that starts the other one is a strong but not perfect signal. */
const FIRST_NAME_PREFIX_SIMILARITY = 0.9;
const MIN_PREFIX_LENGTH = 2;
const MIN_SIMILAR_ORG = 0.92;
const SAME_DOMAIN = 0.95;
const SAME_COMPANY_NAME = 0.9;
const COMPANY_PHONE_CONFIRMED = 0.9;
const MIN_PHONE_CONFIRMED_NAME = 0.8;
const MIN_COMPANY_NAME_SIMILARITY = 0.9;
const SIMILAR_COMPANY_NAME_WEIGHT = 0.8;
const NO_MATCH: PairScore = { score: 0, reason: "No strong signal" };

function text(record: SourceRecord, field: string | undefined): string | null {
  if (!field) return null;
  const value: FieldValue | undefined = record.fields[field];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function personName(record: SourceRecord, fields: MatchFields): string | null {
  const full = text(record, fields.fullName);
  if (full) return normalizePersonName(full);
  const parts = [text(record, fields.firstName), text(record, fields.lastName)].filter(Boolean);
  return normalizePersonName(parts.join(" "));
}

export function buildProfile(
  record: SourceRecord,
  entity: Entity,
  fields: MatchFields,
  defaultCountry?: string,
): Profile {
  const email = normalizeEmail(text(record, fields.email));
  const websiteDomain = corporateDomain(normalizeDomain(text(record, fields.website)));
  const company = normalizeCompanyName(text(record, fields.company));
  const name = entity === "person" ? personName(record, fields) : company;
  return {
    id: record.id,
    email,
    domain: (email && corporateDomain(emailDomain(email))) || websiteDomain,
    name,
    firstName: name?.split(" ")[0] ?? null,
    lastName: name?.split(" ").at(-1) ?? null,
    company,
    phone: normalizePhone(text(record, fields.phone), defaultCountry),
  };
}

/** Blocking keys: only records sharing a key are compared. "exact" keys imply a match on their own. */
export function blockKeys(p: Profile, entity: Entity): { exact: string[]; fuzzy: string[] } {
  const phone = p.phone ? [`p:${p.phone}`] : [];
  if (entity === "company") {
    const name = p.name ? [`n:${p.name.slice(0, 6)}`] : [];
    return { exact: p.domain ? [`d:${p.domain}`] : [], fuzzy: [...phone, ...name] };
  }
  const org = p.domain ?? p.company;
  const nameOrg = p.lastName && org ? [`n:${p.lastName.slice(0, 4)}|${org}`] : [];
  return { exact: p.email ? [`e:${p.email}`] : [], fuzzy: [...phone, ...nameOrg] };
}

function similarity(a: string | null, b: string | null): number {
  return a && b ? jaroWinkler(a, b) : 0;
}

function firstNameSimilarity(a: string, b: string): number {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short !== long && short.length >= MIN_PREFIX_LENGTH && long.startsWith(short)) {
    return FIRST_NAME_PREFIX_SIMILARITY;
  }
  return jaroWinkler(a, b);
}

/** Compares first and last names separately when both have them; otherwise the full name. */
function personNameSimilarity(a: Profile, b: Profile): number {
  const hasParts = (p: Profile) => p.firstName && p.lastName && p.firstName !== p.lastName;
  if (!hasParts(a) || !hasParts(b)) return similarity(a.name, b.name);
  const first = firstNameSimilarity(a.firstName as string, b.firstName as string);
  const last = jaroWinkler(a.lastName as string, b.lastName as string);
  return (first + last) / 2;
}

function scorePeople(a: Profile, b: Profile): PairScore {
  const nameSim = personNameSimilarity(a, b);
  if (a.email && a.email === b.email) {
    const namesConflict = a.name && b.name && nameSim < MAX_CONFLICTING_NAME_SIMILARITY;
    return namesConflict
      ? { score: SAME_EMAIL_DIFFERENT_NAME, reason: "Same email but different names" }
      : { score: SAME_EMAIL, reason: "Same email" };
  }
  if (nameSim < MIN_PERSON_NAME_SIMILARITY) return NO_MATCH;
  if (a.phone && a.phone === b.phone) {
    return { score: SAME_PHONE_SIMILAR_NAME, reason: "Same phone, similar name" };
  }
  const sameOrg = (a.domain && a.domain === b.domain) || (a.company && a.company === b.company);
  if (sameOrg) {
    return { score: SAME_ORG_NAME_WEIGHT * nameSim, reason: "Similar name at the same company" };
  }
  if (similarity(a.company, b.company) >= MIN_SIMILAR_ORG) {
    return {
      score: SIMILAR_ORG_NAME_WEIGHT * nameSim,
      reason: "Similar name at a similar company",
    };
  }
  return NO_MATCH;
}

function scoreCompanies(a: Profile, b: Profile): PairScore {
  if (a.domain && a.domain === b.domain)
    return { score: SAME_DOMAIN, reason: "Same website domain" };
  const nameSim = similarity(a.name, b.name);
  if (nameSim === 1) return { score: SAME_COMPANY_NAME, reason: "Same company name" };
  if (a.phone && a.phone === b.phone && nameSim >= MIN_PHONE_CONFIRMED_NAME) {
    return { score: COMPANY_PHONE_CONFIRMED, reason: "Same phone, similar name" };
  }
  if (nameSim >= MIN_COMPANY_NAME_SIMILARITY) {
    return { score: SIMILAR_COMPANY_NAME_WEIGHT * nameSim, reason: "Similar company name" };
  }
  return NO_MATCH;
}

export function scorePair(a: Profile, b: Profile, entity: Entity): PairScore {
  return entity === "person" ? scorePeople(a, b) : scoreCompanies(a, b);
}
