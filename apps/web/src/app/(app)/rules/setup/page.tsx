import { draftConfig, RULE_TEMPLATES } from "@dedupe/core";
import { EmptyState } from "@/components/EmptyState";
import type { Suggestion } from "@/components/logicParts";
import { RulesWizard } from "@/components/rules/RulesWizard";
import { PageHeader } from "@/components/ui";
import { objectLabel } from "@/lib/objects";
import { getObject } from "@/lib/repo";
import { currentDataset } from "@/lib/service";
import { STEPS, type StepKey } from "@/lib/steps";

export default async function RulesSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; welcome?: string }>;
}) {
  const params = await searchParams;
  const dataset = await currentDataset();
  if (!dataset) {
    return (
      <EmptyState
        title="No object yet"
        body="Add an object to set up its rules."
        href="/objects"
        cta="Add an object"
      />
    );
  }
  const object = await getObject(dataset.objectType);
  const config = object?.config;
  const columns = object?.fields ?? dataset.fieldColumns;
  if (!config)
    return (
      <EmptyState title="No rules yet" body="Re-add the object to generate a starting point." />
    );
  const { suggestions: drafted } = draftConfig(columns, dataset.objectType);
  const suggestions: Record<string, Suggestion> = Object.fromEntries(
    Object.entries(drafted).map(([field, s]) => [
      field,
      { kind: s.tag.kind, confidence: s.source === "default" ? "low" : "high", why: s.why },
    ]),
  );
  const step = STEPS.some((s) => s.key === params.step)
    ? (params.step as StepKey)
    : params.welcome
      ? "keep"
      : "object";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={objectLabel(dataset.objectType)}
        title="Set up rules"
        description={
          params.welcome
            ? "Your data is in and duplicates were found. We pre-filled rules from your fields. Review them, test, then go live."
            : "Five steps: object, how duplicates are found, what survives, test, go live."
        }
      />
      <RulesWizard
        initialStep={step}
        initial={config}
        columns={columns}
        suggestions={suggestions}
        templates={RULE_TEMPLATES}
        object={{
          label: objectLabel(dataset.objectType),
          name: dataset.name,
          records: dataset.recordCount,
        }}
      />
    </div>
  );
}
