# Dedupe-tool

Internal RevOps dedupe + survivorship tool. Read docs/PLAN.md and docs/adr/ first.

- Engine lives in packages/core and must stay pure (no I/O). CLI in packages/cli.
- Survivorship = field tags (origin/current/channel/strongest/combine) over candidate slots (ADR 0001, 0002). Don't reintroduce master-record or per-field rule lists.
- mergeCandidates must stay order-independent; add a test for any new slot type.
- Matching must stay conservative: a wrong auto-merge is the worst failure. New signals need a test proving they don't auto-merge look-alikes.
- Test first (vitest). Keep coverage >= 80%. Run: npm run lint && npm run typecheck && npm run test:coverage
