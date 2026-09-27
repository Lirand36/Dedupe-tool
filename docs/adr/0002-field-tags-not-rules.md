# ADR 0002: Field tags instead of master-record and per-field rules

**Status:** accepted · 2026-09-27

## Context

RevOps thinks in terms of what a field means ("how they first came in", "who's working them now"), not in terms of per-field algorithms. Long lists of master-record and field rules are hard to reason about and still can't express "inbound fields come from the oldest inbound record".

## Decision

- Every field gets one tag: `origin`, `current`, `channel(name, earliest|latest)`, `strongest(ranking)` or `combine`. A sandboxed `custom` formula tag is planned for the rare leftovers.
- Channels are defined once, as conditions on record fields. A record belongs to the first channel that matches.
- The record to keep in the CRM is chosen for technical reasons only (the oldest by default; connectors can prefer the one with the most related records). Its field values don't matter, because the clean values are written onto it.
- `suggestTag` pre-fills tags from field names, so setup is mostly confirming guesses.

## Consequences

- Configuration fits on one screen and reads like business language.
- Every value can be explained in one sentence.
- Unusual logic will need the `custom` tag (not yet built).
