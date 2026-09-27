/** A single field value as it comes out of a CRM or file. Empty values are null, "" or []. */
export type FieldValue = string | number | boolean | null | readonly string[];

/** One record from a source system (a Salesforce Lead, a HubSpot Contact, a CSV row...). */
export interface SourceRecord {
  readonly id: string;
  readonly system: string;
  /** ISO timestamp. Used as the "when" of a value when judging which value is earliest. */
  readonly createdAt: string;
  /** ISO timestamp. Used as the "when" of a value when judging which value is latest. */
  readonly updatedAt: string;
  readonly fields: Readonly<Record<string, FieldValue>>;
  /** Optional per-field timestamps (e.g. from CRM field history). Overrides createdAt/updatedAt. */
  readonly fieldTimestamps?: Readonly<Record<string, string>>;
}

/** What a field means to the business. The tag decides which value survives. */
export type FieldTag =
  | { readonly kind: "origin" }
  | { readonly kind: "current" }
  | { readonly kind: "channel"; readonly channel: string; readonly pick: "earliest" | "latest" }
  | { readonly kind: "strongest"; readonly ranking: readonly string[] }
  | { readonly kind: "combine" };

export type Condition =
  | { readonly field: string; readonly op: "in"; readonly values: readonly string[] }
  | { readonly field: string; readonly op: "notEmpty" };

/** A channel (e.g. inbound, outbound) is defined once; a record belongs to the first channel whose conditions all hold. */
export interface ChannelDefinition {
  readonly name: string;
  readonly when: readonly Condition[];
}

export interface Policy {
  readonly fields: Readonly<Record<string, FieldTag>>;
  readonly channels: readonly ChannelDefinition[];
}

/** A candidate value with the evidence of where and when it was seen. */
export interface Slot {
  readonly value: FieldValue;
  readonly at: string;
  readonly sourceId: string;
}

export interface ChannelSlots {
  readonly earliest: Slot;
  readonly latest: Slot;
}

/** The small, fixed-size summary we keep per field instead of full history. */
export interface FieldCandidates {
  readonly earliest?: Slot;
  readonly latest?: Slot;
  readonly channels?: Readonly<Record<string, ChannelSlots>>;
  /** Distinct values, only kept for "strongest" and "combine" fields. */
  readonly values?: readonly Slot[];
}

export interface Candidates {
  readonly sourceIds: readonly string[];
  readonly fields: Readonly<Record<string, FieldCandidates>>;
}

export interface Reason {
  readonly text: string;
  readonly sourceId?: string;
  readonly at?: string;
}

export interface GoldenRecord {
  readonly values: Readonly<Record<string, FieldValue>>;
  readonly reasons: Readonly<Record<string, Reason>>;
}
