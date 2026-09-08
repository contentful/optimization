# AGENTS.md

This private workspace package composes the shared mock handlers with the Optimization SDK
capabilities needed to run the HTTP server. Keep handler logic, fixtures, state, logger mocks, and
fixture-fetch behavior in `lib/mocks`; this package owns only server composition.

## Commands

- `pnpm --filter mock-server serve`
- `pnpm --filter mock-server typecheck`

Do not add reusable mock behavior or fixture data here.
