import type { RunConfig } from "./config";
import type { Entity, MatchFields } from "./matchScore";
import { suggestTag } from "./suggest";
import type { FieldTag } from "./types";

export type SystemId = "salesforce" | "hubspot" | "other";

/** A CRM object we know: which entity it holds and what its standard fields mean. */
export interface ObjectPreset {
  readonly id: string;
  readonly system: SystemId;
  readonly systemLabel: string;
  readonly objectLabel: string;
  readonly entity: Entity;
  /** API names of the object's standard fields, used as mapping targets for imports. */
  readonly standardFields: readonly string[];
  /** Keyed by normalizeFieldName(apiName). */
  readonly fieldTags: Readonly<Record<string, FieldTag>>;
}

export interface FieldSuggestion {
  readonly tag: FieldTag;
  readonly source: "preset" | "name" | "default";
  readonly why: string;
}

export const DEFAULT_THRESHOLDS = { auto: 0.95, review: 0.75 } as const;

const origin: FieldTag = { kind: "origin" };
const current: FieldTag = { kind: "current" };
const strongest = (ranking: readonly string[]): FieldTag => ({ kind: "strongest", ranking });

const SF_LEAD_STATUS = [
  "Closed - Converted",
  "Working - Contacted",
  "Open - Not Contacted",
  "Closed - Not Converted",
];
const HS_LIFECYCLE = [
  "evangelist",
  "customer",
  "opportunity",
  "salesqualifiedlead",
  "marketingqualifiedlead",
  "lead",
  "subscriber",
  "other",
];
const HS_LEAD_STATUS = [
  "CONNECTED",
  "OPEN_DEAL",
  "IN_PROGRESS",
  "ATTEMPTED_TO_CONTACT",
  "OPEN",
  "NEW",
  "UNQUALIFIED",
  "BAD_TIMING",
];

const SF_PERSON = {
  leadsource: origin,
  title: current,
  email: current,
  phone: current,
  mobilephone: current,
  ownerid: current,
  mailingcountry: current,
  country: current,
};
const HS_PERSON = {
  hsanalyticssource: origin,
  hsanalyticssourcedata1: origin,
  hsanalyticssourcedata2: origin,
  firstconversioneventname: origin,
  hsanalyticsfirsturl: origin,
  hslatestsource: current,
  recentconversioneventname: current,
  jobtitle: current,
  email: current,
  phone: current,
  mobilephone: current,
  hubspotownerid: current,
  lifecyclestage: strongest(HS_LIFECYCLE),
  hsleadstatus: strongest(HS_LEAD_STATUS),
};

export const OBJECT_PRESETS: readonly ObjectPreset[] = [
  {
    id: "salesforce.lead",
    system: "salesforce",
    systemLabel: "Salesforce",
    objectLabel: "Leads",
    entity: "person",
    standardFields: [
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "MobilePhone",
      "Company",
      "Title",
      "Website",
      "LeadSource",
      "Status",
      "Industry",
      "Country",
      "OwnerId",
    ],
    fieldTags: {
      ...SF_PERSON,
      status: strongest(SF_LEAD_STATUS),
      company: current,
      industry: current,
    },
  },
  {
    id: "salesforce.contact",
    system: "salesforce",
    systemLabel: "Salesforce",
    objectLabel: "Contacts",
    entity: "person",
    standardFields: [
      "FirstName",
      "LastName",
      "Email",
      "Phone",
      "MobilePhone",
      "AccountName",
      "Title",
      "LeadSource",
      "MailingCountry",
      "OwnerId",
    ],
    fieldTags: SF_PERSON,
  },
  {
    id: "salesforce.account",
    system: "salesforce",
    systemLabel: "Salesforce",
    objectLabel: "Accounts",
    entity: "company",
    standardFields: [
      "Name",
      "Website",
      "Phone",
      "Industry",
      "Type",
      "AccountSource",
      "NumberOfEmployees",
      "AnnualRevenue",
      "BillingCountry",
      "OwnerId",
    ],
    fieldTags: {
      type: strongest(["Customer", "Partner", "Prospect"]),
      accountsource: origin,
      industry: current,
      numberofemployees: current,
      annualrevenue: current,
      ownerid: current,
      website: current,
      phone: current,
    },
  },
  {
    id: "hubspot.contact",
    system: "hubspot",
    systemLabel: "HubSpot",
    objectLabel: "Contacts",
    entity: "person",
    standardFields: [
      "firstname",
      "lastname",
      "email",
      "phone",
      "mobilephone",
      "company",
      "jobtitle",
      "website",
      "country",
      "lifecyclestage",
      "hs_lead_status",
      "hs_analytics_source",
      "hubspot_owner_id",
    ],
    fieldTags: HS_PERSON,
  },
  {
    id: "hubspot.company",
    system: "hubspot",
    systemLabel: "HubSpot",
    objectLabel: "Companies",
    entity: "company",
    standardFields: [
      "name",
      "domain",
      "phone",
      "industry",
      "country",
      "lifecyclestage",
      "numberofemployees",
      "annualrevenue",
      "hubspot_owner_id",
    ],
    fieldTags: {
      lifecyclestage: strongest(HS_LIFECYCLE),
      hsanalyticssource: origin,
      industry: current,
      numberofemployees: current,
      annualrevenue: current,
      hubspotownerid: current,
      domain: current,
      phone: current,
    },
  },
  {
    id: "other.person",
    system: "other",
    systemLabel: "Other",
    objectLabel: "People",
    entity: "person",
    standardFields: [],
    fieldTags: {},
  },
  {
    id: "other.company",
    system: "other",
    systemLabel: "Other",
    objectLabel: "Companies",
    entity: "company",
    standardFields: [],
    fieldTags: {},
  },
];

export function getPreset(id: string): ObjectPreset | undefined {
  return OBJECT_PRESETS.find((p) => p.id === id);
}

/** "Lead_Source__c", "Lead Source" and "leadsource" all become "leadsource". */
export function normalizeFieldName(name: string): string {
  return name
    .replace(/__c$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const MATCH_ALIASES: Record<
  Entity,
  ReadonlyArray<readonly [keyof MatchFields, readonly string[]]>
> = {
  person: [
    ["email", ["email", "emailaddress"]],
    ["firstName", ["firstname"]],
    ["lastName", ["lastname"]],
    ["fullName", ["fullname", "name"]],
    ["phone", ["phone", "phonenumber", "mobilephone", "mobile"]],
    ["company", ["company", "companyname", "accountname", "account"]],
    ["website", ["website", "domain", "companywebsite"]],
  ],
  company: [
    ["company", ["name", "companyname", "accountname", "company"]],
    ["website", ["website", "domain", "companywebsite", "url"]],
    ["phone", ["phone", "phonenumber"]],
  ],
};

function guessMatchFields(columns: readonly string[], entity: Entity): MatchFields {
  const byName = new Map(columns.map((c) => [normalizeFieldName(c), c]));
  const pairs = MATCH_ALIASES[entity].flatMap(([key, aliases]) => {
    const column = aliases.map((a) => byName.get(a)).find(Boolean);
    return column ? [[key, column] as const] : [];
  });
  return Object.fromEntries(pairs);
}

function suggestionFor(column: string, preset: ObjectPreset): FieldSuggestion {
  const fromPreset = preset.fieldTags[normalizeFieldName(column)];
  if (fromPreset) {
    return {
      tag: fromPreset,
      source: "preset",
      why: `Standard ${preset.systemLabel} ${preset.objectLabel} field`,
    };
  }
  const guess = suggestTag(column);
  return {
    tag: guess.tag,
    source: guess.confidence === "high" ? "name" : "default",
    why: guess.why,
  };
}

/** A complete starting config for an object: match columns mapped, every field tagged. */
export function draftConfig(
  columns: readonly string[],
  presetId: string,
): { config: RunConfig; suggestions: Record<string, FieldSuggestion> } {
  const preset = getPreset(presetId);
  if (!preset) throw new Error(`Unknown object "${presetId}"`);
  const suggestions = Object.fromEntries(columns.map((c) => [c, suggestionFor(c, preset)]));
  return {
    config: {
      policy: {
        channels: [],
        fields: Object.fromEntries(columns.map((c) => [c, suggestions[c]?.tag as FieldTag])),
      },
      match: {
        entity: preset.entity,
        fields: guessMatchFields(columns, preset.entity),
        thresholds: DEFAULT_THRESHOLDS,
      },
    },
    suggestions,
  };
}
