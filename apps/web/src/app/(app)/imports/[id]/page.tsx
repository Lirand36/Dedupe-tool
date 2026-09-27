import { ArrowRightLeft, Download, FilePlus2, Layers, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GroupList } from "@/components/groups/GroupList";
import { PageHeader, SectionTitle, StatCard, Tabs } from "@/components/ui";
import { loadGroupPage, STATUS_FILTERS, type StatusFilter } from "@/lib/groupViews";
import { objectLabel } from "@/lib/objects";
import { getDataset } from "@/lib/repo";
import { importPlanFor } from "@/lib/service";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  review: "Needs review",
  ready: "Ready",
  merged: "Merged",
  rejected: "Not duplicates",
};

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const dataset = await getDataset(id);
  if (!dataset) notFound();
  if (dataset.status !== "ready") redirect(`/imports/${id}/map`);
  if (dataset.kind === "crm") redirect("/crm");
  const status = STATUS_FILTERS.includes(query.status as StatusFilter)
    ? (query.status as StatusFilter)
    : "all";
  const [{ plan, hasCrm }, groups] = await Promise.all([
    importPlanFor(dataset),
    loadGroupPage(dataset, { status, query: "", page: Number(query.page) || 1 }),
  ]);
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
      <section id="groups" className="space-y-4">
        <SectionTitle
          title="Duplicate groups"
          description="Rows that match each other or an existing CRM record. Approve uncertain groups to merge them in the files."
        />
        <Tabs
          active={status}
          items={STATUS_FILTERS.filter((s) => s !== "merged").map((s) => ({
            key: s,
            label: FILTER_LABELS[s],
            href: `/imports/${dataset.id}?status=${s}#groups`,
            count: groups.counts[s],
          }))}
        />
        <GroupList
          key={`${status}-${groups.page}`}
          groups={groups.groups}
          datasetId={dataset.id}
          mode="import"
        />
      </section>
    </div>
  );
}
