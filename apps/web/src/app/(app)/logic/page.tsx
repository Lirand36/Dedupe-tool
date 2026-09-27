import { suggestTag } from "@dedupe/core";
import { EmptyState } from "@/components/EmptyState";
import { LogicEditor, type Suggestion } from "@/components/LogicEditor";
import { deleteExampleAction } from "@/lib/actions";
import { getConfig, listExamples } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

export default async function LogicPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const dataset = await currentDataset();
  if (!dataset) {
    return (
      <EmptyState
        title="No dataset yet"
        body="Upload a CSV to set up your logic."
        href="/data"
        cta="Upload a dataset"
      />
    );
  }
  const [config, examples] = await Promise.all([getConfig(dataset.id), listExamples(dataset.id)]);
  if (!config)
    return (
      <EmptyState title="No logic yet" body="Re-upload the dataset to generate a starting point." />
    );
  const suggestions: Record<string, Suggestion> = Object.fromEntries(
    dataset.fieldColumns.map((f) => {
      const s = suggestTag(f);
      return [f, { kind: s.tag.kind, confidence: s.confidence, why: s.why }];
    }),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logic</h1>
        <p className="text-sm text-muted">
          Say what each field means. The clean record follows from that.
        </p>
      </div>
      {welcome && (
        <div className="card border-indigo-200 bg-accent-soft p-4 text-sm">
          <strong>Your data is in and duplicates were found.</strong> We guessed a tag for every
          field from its name. Check the ones marked <em>guess</em>, add your inbound/outbound
          channels, then save. Everything re-runs on save.
        </div>
      )}
      <LogicEditor initial={config} columns={dataset.fieldColumns} suggestions={suggestions} />
      <section className="card p-5">
        <h2 className="font-semibold">Examples</h2>
        <p className="mb-4 text-sm text-muted">
          Groups you saved from the Inbox. Every logic change is checked against them before you
          save.
        </p>
        {examples.length === 0 ? (
          <p className="text-sm text-muted">
            No examples yet. Open a group in the Inbox and click "Save as example".
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {examples.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-2 text-sm">
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
