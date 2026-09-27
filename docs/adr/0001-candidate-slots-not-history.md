# ADR 0001: Keep candidate slots, not full history

**Status:** accepted · 2026-09-27

## Context

Choosing survivors at merge time loses the losing values forever, so survivorship logic can't be changed afterwards. Storing every value ever seen per record would fix that, but it's heavy and grows with every update.

## Decision

For each duplicate group, and each **tagged** field, keep a fixed set of slots, where a slot is value + timestamp + source record id:

- `earliest` and `latest`, for every tagged field
- `earliest` and `latest` per channel the record belonged to
- distinct values, for `strongest` and `combine` fields only, capped at `MAX_DISTINCT_VALUES` (50)

`mergeCandidates` is commutative and associative. Ties break by source id, so the result never depends on sync order. The clean record is `resolveGolden(slots, policy)`.

Records with no duplicates store nothing. The CRM stays the source of truth for them.

## Consequences

- Size is bounded by groups × tagged fields × a few slots, not by how often records change. For about 100k duplicate groups × 30 fields that's a few hundred MB.
- Retagging a field between `origin`, `current` and `channel` works retroactively.
- Retagging a field *to* `strongest` or `combine`, or adding a new field, needs the source records again. For merged-away records that means the pre-merge snapshot (90-day retention).
- Changing a channel definition applies going forward, not to slots already assigned.
- Custom formulas (later) can only read slots, not arbitrary past values. If a real need comes up, full history can be added for that one field.
