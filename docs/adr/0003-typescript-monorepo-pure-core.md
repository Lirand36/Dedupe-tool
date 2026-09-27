# ADR 0003: TypeScript monorepo with a pure engine

**Status:** accepted · 2026-09-27

## Decision

- One language end to end: TypeScript, Next.js for the UI later, Node workers.
- npm workspaces, because it has no extra tooling to install.
- Packages export their TypeScript source directly (`exports: ./src/index.ts`) and run through `tsx`/`vitest`. There's no build step until a deployable app needs one.
- `packages/core` does no I/O, so every rule is unit-testable and the same code runs in the CLI, the worker and the web preview.
- Config and CSV input are validated at the boundary: zod for config, explicit row checks for CSV. Errors list every problem in plain words.
- Tooling: Biome (lint + format), Vitest with an 80% coverage gate, strict `tsc` (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
