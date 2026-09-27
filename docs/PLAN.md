# Plan

## Problem

Pressing "merge" is easy. The hard part is making sure the **right data survives** every merge:
- inbound attribution keeps the oldest data
- outbound fields keep the newest
- "first/last" date fields stop getting overwritten

Existing tools make you pick a master record and write a rule per field, and whatever loses is deleted. Logic has to be right up front and can't be changed later.

## Principles

1. **Tag meaning, don't write rules.** About six tags cover almost every field, and names are auto-suggested ("First_…" → origin).
2. **Compute the clean record from small candidate slots.** Logic changes can be re-applied to past merges without storing history ([ADR 0001](adr/0001-candidate-slots-not-history.md)).
3. **Examples are tests.** A corrected duplicate becomes a saved example. Policy changes show "what would change" and which examples would break before they go live.
4. **Quiet by default.** High-confidence groups merge automatically. People only see an Inbox of exceptions.
5. **The engine has no knowledge of any CRM.** Salesforce, HubSpot and CSV/warehouse are connectors behind one interface.

## Product: three screens

- **Inbox**: uncertain matches, unresolved conflicts, failed syncs. Records side by side with the clean record and a reason per value.
- **Logic**: field tags, channel definitions, match sensitivity, saved examples, change preview.
- **Health**: duplicate rate, fixes this week, estimated hours saved, fill rates, change log with undo.

Settings holds connections and field mapping. Lead-to-account matching and normalization are steps of the same background process.

## Architecture

- TypeScript monorepo (npm workspaces).
- `packages/core`: a pure engine with no I/O.
- Next: `apps/web` (Next.js), `apps/worker` (Node + BullMQ/Redis), Postgres (`identity`, `field_candidates` as JSONB, `field_tag`, `channel_definition`, `example`, `merge_snapshot` with 90-day retention, `audit_log`).
- Connector interface: `describeSchema`, `pullIncremental`, `merge`, `updateFields`, `convertLead`, `restore`, `rateLimitPolicy`.

## Roadmap

| # | Phase | Status |
|---|---|---|
| 0 | Foundations: repo, CI, lint, tests | done |
| 1 | Engine: tags, candidate slots, clean records with reasons, matching, examples, config validation, CSV CLI | done (v0.1) |
| 2 | Web UI v1 on CSV: import, tag fields (with suggestions), Inbox, change preview, export. Postgres + auth. Render deploy. | done (v0.2) |
| 2.5 | User journey (v0.3): objects with Salesforce/HubSpot presets, 5-step rules setup, templates, test sandbox, rules summary/table/field-map graph, history log, dark-sidebar design | done (v0.3) |
| 2.6 | CRM vs Imports (v0.4): rules belong to the object; CRM data per object (export upload until live connection); import cleaning with column mapping, insert/update split against CRM data | done (v0.4) |
| 2.7 | Object duplicate tables (v0.5): per-object duplicates preview, group tables (records × fields, survivor column), master choice, overrides, Merge now / bulk / Not duplicates, recurring auto-merge schedule (saved; executes once connected), merge plan | done (v0.5) |
| 3 | Salesforce: OAuth, background sync, loading existing history, write-back + merge, tiers, undo snapshots, schedules | next |
| 4 | HubSpot + warehouse sources | |
| 5 | Lead-to-account matching, normalization jobs, Lead↔Contact cross-object dedupe | |
| 6 | Health dashboard, Slack digest, alerts | |
| 7 | Hardening: security review, 1–5M record performance, e2e tests | |

## Known limits and risks

| Risk | Mitigation |
|---|---|
| CRM merges can't be fully undone | Snapshot before every merge, sandbox first, dry run by default, auto-merge only for high confidence |
| Wrong auto-merges destroy trust | Conservative thresholds (auto ≥ 0.95), a shared free-email domain is never a match signal, weakest-link confidence |
| Changing a **channel definition** can't be re-applied to records already merged away (slots were assigned at merge time) | Retagging fields works retroactively. Channel changes apply going forward, and to snapshots inside the retention window. |
| History from before the tool is partial | Backfill from existing date/source fields, campaign members and form submissions. Mark those values as reconstructed. |
| API rate limits | Bulk APIs, per-connector rate budgets, resumable jobs |
