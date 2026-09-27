import { goldenFromRecords } from "./golden";
import type { FieldValue, Policy, SourceRecord } from "./types";

/** A real duplicate group plus the values RevOps says are correct. Acts as a test for the policy. */
export interface Example {
  readonly name: string;
  readonly records: readonly SourceRecord[];
  readonly expected: Readonly<Record<string, FieldValue>>;
}

export interface ExampleFailure {
  readonly example: string;
  readonly field: string;
  readonly expected: FieldValue;
  readonly actual: FieldValue;
}

export interface PolicyChangeSample {
  readonly sourceIds: readonly string[];
  readonly field: string;
  readonly before: FieldValue;
  readonly after: FieldValue;
}

export interface PolicyChangePreview {
  readonly changedGroups: number;
  readonly byField: Readonly<Record<string, number>>;
  readonly samples: readonly PolicyChangeSample[];
}

export const MAX_PREVIEW_SAMPLES = 20;

function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function checkExamples(examples: readonly Example[], policy: Policy): ExampleFailure[] {
  return examples.flatMap((example) => {
    const golden = goldenFromRecords(example.records, policy);
    return Object.entries(example.expected)
      .filter(([field, expected]) => !sameValue(golden.values[field], expected))
      .map(([field, expected]) => ({
        example: example.name,
        field,
        expected,
        actual: golden.values[field] ?? null,
      }));
  });
}

/** Shows what switching from one policy to another would change, before anything is written. */
export function previewPolicyChange(
  groups: readonly (readonly SourceRecord[])[],
  before: Policy,
  after: Policy,
): PolicyChangePreview {
  const changes = groups.flatMap((records) => {
    const [old, next] = [goldenFromRecords(records, before), goldenFromRecords(records, after)];
    const fields = [...new Set([...Object.keys(old.values), ...Object.keys(next.values)])];
    return fields
      .filter((field) => !sameValue(old.values[field], next.values[field]))
      .map((field) => ({
        sourceIds: records.map((r) => r.id),
        field,
        before: old.values[field] ?? null,
        after: next.values[field] ?? null,
      }));
  });
  const byField: Record<string, number> = {};
  for (const change of changes) byField[change.field] = (byField[change.field] ?? 0) + 1;
  return {
    changedGroups: new Set(changes.map((c) => c.sourceIds.join("|"))).size,
    byField,
    samples: changes.slice(0, MAX_PREVIEW_SAMPLES),
  };
}
