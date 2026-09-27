import { FlaskConical, Pencil } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { FieldMapGraph } from "@/components/rules/FieldMapGraph";
import { RulesSummary } from "@/components/rules/RulesSummary";
import { RulesTable } from "@/components/rules/RulesTable";
import { PageHeader, SectionTitle, Tabs } from "@/components/ui";
import { deleteExampleAction } from "@/lib/actions";
import { objectLabel } from "@/lib/objects";
import { countEvents, getConfig, listExamples } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

const VIEWS = ["summary", "table", "graph"] as const;
type View = (typeof VIEWS)[number];

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
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
  const [config, examples, counts] = await Promise.all([
    getConfig(dataset.id),
    listExamples(dataset.id),
    countEvents(dataset.id),
  ]);
  if (!config)
    return (
      <EmptyState title="No rules yet" body="Re-add the object to generate a starting point." />
    );
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : "summary";
  const version =
    counts.rules > 0 ? `Rules v${counts.rules} · live` : "Suggested rules · not reviewed yet";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow={`${objectLabel(dataset.objectType)} · ${version}`}
        title="Rules"
        description="How duplicates are found and which data survives a merge."
        actions={
          <>
            <Link href="/rules/setup?step=test" className="btn-ghost">
              <FlaskConical size={16} aria-hidden /> Test records
            </Link>
            <Link href="/rules/setup" className="btn-primary">
              <Pencil size={16} aria-hidden /> Edit rules
            </Link>
          </>
        }
      />
      <Tabs
        active={view}
        items={[
          { key: "summary", label: "Summary", href: "/rules?view=summary" },
          { key: "table", label: "Table", href: "/rules?view=table" },
          { key: "graph", label: "Graph", href: "/rules?view=graph" },
        ]}
      />
      {view === "summary" && <RulesSummary config={config} columns={dataset.fieldColumns} />}
      {view === "table" && <RulesTable config={config} columns={dataset.fieldColumns} />}
      {view === "graph" && (
        <section className="card p-6">
          <SectionTitle
            title="Field map"
            description="Where each value of the clean record comes from. Colors match the rule."
          />
          <FieldMapGraph policy={config.policy} />
        </section>
      )}
      <section className="card p-6">
        <SectionTitle
          title="Saved examples"
          description="Real groups you confirmed in Review. Every rule change is checked against them before it goes live."
        />
        {examples.length === 0 ? (
          <p className="text-sm text-muted">
            No examples yet. Open a group in Review and click "Save as example".
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {examples.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span>
                  {e.name}{" "}
                  <span className="text-muted">
                    · {e.records.length} records · {Object.keys(e.expected).length} fields checked
                  </span>
                </span>
                <form action={deleteExampleAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className="text-xs text-muted hover:text-bad">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
