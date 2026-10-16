# AGENTS.md

Owns Node-specific SDK behavior built on `@contentful/optimization-core`.

## Rules

- Keep this package Node-oriented; do not add browser-only assumptions or DOM dependencies.
- Put reusable cross-platform behavior in `core-sdk`.
- Keep `dev/` as a maintained server-integration harness. It reads `.env` from this package and
  expects the repo-standard `PUBLIC_...` keys in `.env.example`.

## Commands

- `pnpm --filter @contentful/optimization-node <script>` with `typecheck`, `test:unit`, `build`,
  `size:check`, `size:report`, or `dev`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Handle bundle-size failures under the root `Bundle size` policy.
- Validate the package-local `dev` flow when changing flows it exercises.
- Validate `implementations/node-sdk` E2E for runtime or SSR behavior changes.
