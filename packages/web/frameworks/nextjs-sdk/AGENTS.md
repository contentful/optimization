# AGENTS.md

Next.js adapter package for composing the Node SDK on the server with the React Web SDK on the
client.

## Rules

- Keep this package as glue only. Server and request-handler helpers delegate to
  `@contentful/optimization-node`; client exports delegate to `@contentful/optimization-react-web`.
- Do not import `@contentful/optimization-core` directly.
- Keep server entries free of client directives and browser-only assumptions.
- Keep client entries marked with `"use client"` and free of Node-only imports.

## Commands

- `pnpm --filter @contentful/optimization-nextjs <script>` with `typecheck`, `test:unit`, `build`,
  `size:check`, or `size:report`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Run `size:check` and handle failures under the root `Bundle size` policy.
