# Dedupe-tool

An internal RevOps tool that finds duplicate people and companies across Salesforce, HubSpot and files, and decides **which data survives** based on what each field *means*, not on per-field rules.

## The idea in one example

Dana filled a pricing-demo form in 2023. In 2025 an SDR cold-called her and created a second lead. After the merge you want:

| Field | Keep | Why |
|---|---|---|
| Lead Source, Original Form, UTM | Web Form / Pricing Demo / q1-brand | How she **first** arrived (inbound) |
| SDR Owner, Sequence | Sam SDR / Enterprise Q1 | **Latest outbound** touch |
| Title | VP Marketing | **Current** truth |
| Lifecycle Stage | SQL | **Strongest** stage reached |
| Interests | Analytics; Integrations | **Combine** all |

You don't write rules for this. You tag each field once:

| Tag | Meaning |
|---|---|
| `origin` | earliest value |
| `current` | latest non-empty value |
| `channel` | earliest or latest value from one channel (inbound, outbound, …), defined once |
| `strongest` | highest value in a ranking you give (e.g. Customer > SQL > MQL) |
| `combine` | all distinct values |

Every clean value comes with a reason, e.g. "Earliest inbound value (2023-03-01), from L-001".

## How it stays light

We don't store history. Each duplicate group keeps a few **candidate slots** per tagged field: the earliest and latest value, the earliest and latest per channel, and distinct values for `strongest`/`combine` fields. Merging is order-independent, and retagging a field later (say from `current` to `origin`) just reads the other slot. Records with no duplicates store nothing. See [ADR 0001](docs/adr/0001-candidate-slots-not-history.md).

## Try it on a CSV (no CRM touched)

```bash
npm install
npm run dedupe -- suggest --input examples/contacts.csv --out out/draft-config.json
npm run dedupe -- run --input examples/contacts.csv --config examples/config.json --out out/clean.csv --report out/report.json
```

CSV files need `id`, `createdAt`, `updatedAt` columns. Multi-value cells use `;`.

`out/clean.csv` has one row per duplicate group:
- `tier`: `auto` (safe to merge) or `review` (a person should check)
- `keep_record_id` and `remove_record_ids`
- every clean value, plus a `<field>__why` column

## The web app

A single-admin web app with four screens:
- **Health**: duplicate rate, what's ready, what needs you, emptiest fields, run history.
- **Inbox**: only the groups that need a person. Records side by side with the clean record and a reason per value. Click any value to use it instead, approve or reject, or save a group as an example.
- **Logic**: channels, one tag per field (pre-filled), matching settings, and **Preview impact** before **Save and re-run**. Decisions on unchanged groups are kept.
- **Data**: upload CSV exports. Download the clean CSV from Health.

Run it locally (it uses an embedded Postgres, so nothing to install):

```bash
cp apps/web/.env.example apps/web/.env.local   # set ADMIN_PASSWORD and SESSION_SECRET
npm run dev:web                                # http://localhost:3000
```

### Deploy on Render

`render.yaml` is a Render Blueprint:
1. In Render, click **New → Blueprint** and pick this repo.
2. When asked, enter `ADMIN_PASSWORD` (12+ characters).

Render creates the web service and a Postgres database, generates `SESSION_SECRET`, and redeploys on every push to `main`.

## Repo layout

```
packages/core   Pure engine: normalize, match, group, candidate slots, clean records, examples-as-tests
packages/cli    CSV in, clean CSV out; drafts a config from CSV headers
apps/web        Next.js app: login, Health, Inbox, Logic, Data; Postgres via plain SQL
docs/PLAN.md    Product plan and roadmap
docs/adr/       Architecture decisions
```

## Development

```bash
npm test               # vitest
npm run test:coverage  # 80% minimum on lines, branches, functions, statements
npm run typecheck
npm run lint           # biome
```
