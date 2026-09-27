import { getPreset } from "@dedupe/core";
import { Download, GitMerge, Search, UploadCloud } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { DuplicatePreview } from "@/components/groups/DuplicatePreview";
import { GroupList } from "@/components/groups/GroupList";
import { ScheduleForm } from "@/components/groups/ScheduleForm";
import { PageHeader, Tabs } from "@/components/ui";
import { selectDatasetAction } from "@/lib/actions";
import { nextRun } from "@/lib/groups";
import { loadGroupPage, STATUS_FILTERS, type StatusFilter } from "@/lib/groupViews";
import { crmSnapshot, getObject } from "@/lib/repo";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  review: "Needs review",
  ready: "Ready",
  merged: "Merged",
  rejected: "Not duplicates",
};

export default async function ObjectDuplicatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ object: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const [{ object: objectType }, query] = await Promise.all([params, searchParams]);
  const preset = getPreset(objectType);
  if (!preset) notFound();
  const title = `${preset.systemLabel} ${preset.objectLabel}`;
  const snapshot = await crmSnapshot(objectType);
  if (!snapshot) {
    return (
      <EmptyState
        icon={UploadCloud}
        title={`No ${title} data yet`}
        body="Upload an export of the object with its record ID to see the duplicates in your CRM today."
        href={`/imports/new?kind=crm&object=${objectType}`}
        cta="Upload export"
      />
    );
  }
  const status = STATUS_FILTERS.includes(query.status as StatusFilter)
    ? (query.status as StatusFilter)
    : "all";
  const q = (query.q ?? "").slice(0, 100);
  const [page, object] = await Promise.all([
    loadGroupPage(snapshot, { status, query: q, page: Number(query.page) || 1 }),
    getObject(objectType),
  ]);
  const schedule = object?.schedule ?? null;
  const next = schedule ? nextRun(schedule, new Date()) : null;
  const href = (overrides: Record<string, string | number>) => {
    const p = new URLSearchParams({
      status,
      ...(q && { q }),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    });
    return `/crm/${objectType}?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={`CRM · ${snapshot.recordCount.toLocaleString()} records · export from ${snapshot.createdAt.toLocaleDateString()}`}
        title={title}
        description="Every duplicate group in this object. Merge now, leave it to the schedule, or mark it not duplicates."
        actions={
          <>
            {page.stats.byStatus.merged > 0 && (
              <a href={`/api/crm/${objectType}/merge-plan`} className="btn-ghost">
                <Download size={16} aria-hidden /> Merge plan
              </a>
            )}
            <form action={selectDatasetAction}>
              <input type="hidden" name="id" value={snapshot.id} />
              <input type="hidden" name="next" value="/rules" />
              <button type="submit" className="btn-ghost">
                <GitMerge size={16} aria-hidden /> Rules
              </button>
            </form>
          </>
        }
      />
      <DuplicatePreview stats={page.stats} objectRecords={snapshot.recordCount} />
      <ScheduleForm
        objectType={objectType}
        initial={schedule}
        readyGroups={page.stats.byStatus.ready}
        nextRunLabel={next ? `${next.toUTCString().slice(0, 22)} UTC` : null}
        connected={false}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={status}
          items={STATUS_FILTERS.map((s) => ({
            key: s,
            label: FILTER_LABELS[s],
            href: href({ status: s, page: 1 }),
            count: page.counts[s],
          }))}
        />
        <form className="relative" action={`/crm/${objectType}`}>
          <input type="hidden" name="status" value={status} />
          <Search
            size={15}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, company"
            className="input w-72 pl-9"
            aria-label="Search groups"
          />
        </form>
      </div>
      <GroupList
        key={`${status}-${q}-${page.page}`}
        groups={page.groups}
        datasetId={snapshot.id}
        mode="crm"
      />
      {page.pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pages">
          {page.page > 1 && (
            <Link href={href({ page: page.page - 1 })} className="btn-ghost px-3 py-1.5">
              Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page.page} of {page.pages}
          </span>
          {page.page < page.pages && (
            <Link href={href({ page: page.page + 1 })} className="btn-ghost px-3 py-1.5">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
