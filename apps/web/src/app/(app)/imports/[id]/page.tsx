import { ArrowRightLeft, Download, FilePlus2, Inbox, Layers, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { selectDatasetAction } from "@/lib/actions";
import { objectLabel } from "@/lib/objects";
import { getDataset } from "@/lib/repo";
import { importPlanFor } from "@/lib/service";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dataset = await getDataset(id);
  if (!dataset) notFound();
  if (dataset.status !== "ready") redirect(`/imports/${id}/map`);
  if (dataset.kind === "crm") redirect("/crm");
  const { plan, hasCrm } = await importPlanFor(dataset);
  const label = objectLabel(dataset.objectType);
  const { stats } = plan;
  const files = [
    {
      key: "clean",
      title: "Clean file",
      body: "One row per person. Existing records carry their CRM Id.",
      count: stats.inserts + stats.updates,
    },
    ...(hasCrm
      ? [
          {
            key: "insert",
            title: "New records",
            body: "Import these as new records.",
            count: stats.inserts,
          },
          {
            key: "update",
            title: "Updates",
            body: "Update these existing records by Id.",
            count: stats.updates,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow={`Import into ${label}`}
        title={dataset.name}
        description={`${stats.fileRows} rows in the file. Rules: ${label}.`}
        actions={
          <form action={selectDatasetAction}>
            <input type="hidden" name="id" value={dataset.id} />
            <input type="hidden" name="next" value="/inbox" />
            <button type="submit" className="btn-ghost">
              <Inbox size={16} aria-hidden /> Review groups
            </button>
          </form>
        }
      />
      {stats.pendingReview > 0 && (
        <div className="card border-amber-200 bg-warn-soft p-4 text-sm">
          <strong>{stats.pendingReview}</strong>{" "}
          {stats.pendingReview === 1 ? "group still needs" : "groups still need"} a look. Until you
          approve them, their rows stay separate in the files below.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={FilePlus2}
          label="New records"
          value={String(stats.inserts)}
          tone="emerald"
        />
        <StatCard
          icon={RefreshCw}
          label="Existing, to update"
          value={hasCrm ? String(stats.updates) : "—"}
          hint={hasCrm ? undefined : "Needs CRM data"}
          tone="sky"
        />
        <StatCard
          icon={Layers}
          label="Merged within file"
          value={String(stats.mergedInFile)}
          tone="violet"
        />
        <StatCard
          icon={ArrowRightLeft}
          label="Waiting for review"
          value={String(stats.pendingReview)}
          tone="amber"
        />
      </div>
      <section className="card p-6">
        <SectionTitle
          title="Download"
          description="Import-ready CSVs with the object's field names. Helper columns start with _."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {files.map((f) => (
            <a
              key={f.key}
              href={`/api/imports/${dataset.id}/${f.key}`}
              className="rounded-xl border border-line p-4 transition hover:border-accent hover:bg-accent-soft/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.title}</span>
                <Download size={16} className="text-accent" aria-hidden />
              </div>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
              <p className="mt-2 text-xs font-medium text-muted">{f.count} rows</p>
            </a>
          ))}
        </div>
        {!hasCrm && (
          <p className="mt-4 text-sm text-muted">
            To split new people from existing ones,{" "}
            <Link
              href={`/imports/new?kind=crm&object=${dataset.objectType}`}
              className="text-accent hover:underline"
            >
              upload a {label} export
            </Link>{" "}
            in CRM. This import is re-checked against it automatically.
          </p>
        )}
      </section>
    </div>
  );
}
