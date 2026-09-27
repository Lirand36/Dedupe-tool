import "server-only";
import type { GroupView } from "@/components/groups/GroupCard";
import { type DuplicateStats, duplicateStats, type GroupStatus, statusOf } from "./groups";
import {
  type DatasetSummary,
  getObject,
  type IdentityRow,
  latestRun,
  listIdentities,
} from "./repo";
import { datasetRecords } from "./service";
import { buildComparison, groupLabel } from "./views";

export const GROUPS_PER_PAGE = 15;
export const STATUS_FILTERS = ["all", "review", "ready", "merged", "rejected"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface GroupPage {
  readonly stats: DuplicateStats;
  readonly counts: Readonly<Record<StatusFilter, number>>;
  readonly groups: readonly GroupView[];
  readonly page: number;
  readonly pages: number;
  readonly identities: readonly IdentityRow[];
}

/** One page of duplicate groups for a CRM export or import, filtered by status and a search term. */
export async function loadGroupPage(
  dataset: DatasetSummary,
  options: { status: StatusFilter; query: string; page: number },
): Promise<GroupPage> {
  const [object, run, records] = await Promise.all([
    getObject(dataset.objectType),
    latestRun(dataset.id),
    datasetRecords(dataset),
  ]);
  const identities = run ? await listIdentities(run.id) : [];
  const byId = new Map(records.map((r) => [r.id, r]));
  const statusById = new Map(identities.map((i) => [i.id, statusOf(i)]));
  const matchFields = object?.config.match.fields ?? {};
  const query = options.query.trim().toLowerCase();
  const matchesQuery = (i: IdentityRow) =>
    query === "" ||
    i.sourceIds.some((id) =>
      Object.values(byId.get(id)?.cells ?? {}).some((v) => v.toLowerCase().includes(query)),
    );
  const inStatus = (i: IdentityRow, s: StatusFilter) => s === "all" || statusById.get(i.id) === s;
  const searched = identities.filter(matchesQuery);
  const filtered = searched.filter((i) => inStatus(i, options.status));
  const pages = Math.max(1, Math.ceil(filtered.length / GROUPS_PER_PAGE));
  const page = Math.min(Math.max(1, options.page), pages);
  const slice = filtered.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE);
  const policy = object?.config.policy ?? { channels: [], fields: {} };

  return {
    stats: duplicateStats(
      identities.map((i) => ({
        ...i,
        size: i.sourceIds.length,
        reasons: i.evidence.map((e) => e.reason),
      })),
      dataset.recordCount,
    ),
    counts: Object.fromEntries(
      STATUS_FILTERS.map((s) => [s, searched.filter((i) => inStatus(i, s)).length]),
    ) as Record<StatusFilter, number>,
    groups: slice.map((i) => {
      const members = i.sourceIds.flatMap((id) => byId.get(id) ?? []);
      return {
        id: i.id,
        label: groupLabel(byId.get(i.masterId), matchFields),
        status: statusById.get(i.id) as GroupStatus,
        confidence: i.confidence,
        reasons: i.evidence.map((e) => e.reason),
        recordIds: i.sourceIds,
        masterId: i.masterId,
        rows: buildComparison(
          members,
          dataset.fieldColumns,
          policy,
          i.golden,
          i.overrides,
          i.masterId,
        ),
      };
    }),
    page,
    pages,
    identities,
  };
}
