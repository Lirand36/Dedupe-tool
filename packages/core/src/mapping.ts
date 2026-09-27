import { getPreset, normalizeFieldName } from "./presets";

/** How the columns of an uploaded file land on an object. Specials are the record's own id and dates. */
export interface ColumnMap {
  /** File column → object field, or null to skip the column. Unlisted columns keep their name. */
  readonly fields: Readonly<Record<string, string | null>>;
  readonly id?: string | undefined;
  readonly createdAt?: string | undefined;
  readonly updatedAt?: string | undefined;
}

const SPECIALS: Readonly<Record<"id" | "createdAt" | "updatedAt", readonly string[]>> = {
  id: [
    "id",
    "recordid",
    "contactid",
    "leadid",
    "accountid",
    "companyid",
    "hsobjectid",
    "salesforceid",
    "sfid",
  ],
  createdAt: ["createdat", "createddate", "createdate", "datecreated", "createdon", "createdtime"],
  updatedAt: [
    "updatedat",
    "lastmodifieddate",
    "lastmodified",
    "modifieddate",
    "updateddate",
    "hslastmodifieddate",
    "lastmodifiedat",
    "updatedon",
  ],
};

/** Header spellings that mean the same thing. Each group is matched against the object's fields. */
const SYNONYMS: readonly (readonly string[])[] = [
  ["email", "emailaddress", "mail", "workemail", "businessemail"],
  ["firstname", "first", "givenname", "fname", "forename"],
  ["lastname", "surname", "familyname", "lname", "last"],
  ["phone", "phonenumber", "telephone", "tel", "workphone", "businessphone"],
  ["mobilephone", "mobile", "cellphone", "cell", "mobilephonenumber"],
  ["company", "companyname", "accountname", "account", "organization", "organisation", "employer"],
  ["title", "jobtitle", "position", "role"],
  ["website", "url", "web", "domain", "companywebsite"],
  ["leadsource", "source", "originalsource", "hsanalyticssource"],
  ["country", "mailingcountry", "billingcountry"],
  ["name", "fullname"],
];
const COMPANY_GROUP = 5;

/** The fields an object has: its standard CRM fields plus any seen before (custom fields). */
export function objectFields(objectType: string, extra: readonly string[]): string[] {
  return [...new Set([...(getPreset(objectType)?.standardFields ?? []), ...extra])];
}

function specialFor(normalized: string): keyof typeof SPECIALS | undefined {
  return (Object.keys(SPECIALS) as (keyof typeof SPECIALS)[]).find((k) =>
    SPECIALS[k].includes(normalized),
  );
}

function targetFor(normalized: string, targets: ReadonlyMap<string, string>): string | undefined {
  const exact = targets.get(normalized);
  if (exact) return exact;
  const groupIndex = SYNONYMS.findIndex((g) => g.includes(normalized));
  const group = SYNONYMS[groupIndex];
  if (!group) return undefined;
  const match = group.map((alias) => targets.get(alias)).find(Boolean);
  // Company objects call their name field "Name" (Salesforce Accounts, HubSpot Companies).
  return match ?? (groupIndex === COMPANY_GROUP ? targets.get("name") : undefined);
}

/** Suggests where every column of a file should go. The admin confirms or changes each one. */
export function suggestColumnMap(
  columns: readonly string[],
  targetFields: readonly string[],
): ColumnMap {
  const targets = new Map(targetFields.map((f) => [normalizeFieldName(f), f]));
  const used = new Set<string>();
  const specials: { id?: string; createdAt?: string; updatedAt?: string } = {};
  const fields: Record<string, string | null> = {};
  for (const column of columns) {
    const normalized = normalizeFieldName(column);
    const special = specialFor(normalized);
    if (special && !specials[special]) {
      specials[special] = column;
      continue;
    }
    const target = targetFor(normalized, targets);
    const chosen = target && !used.has(target) ? target : column;
    used.add(chosen);
    fields[column] = chosen;
  }
  return { fields, ...specials };
}
