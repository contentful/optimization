# AGENTS.md

Next.js adapter package for composing the Node SDK on the server with the React Web SDK on the
client.

## Rules

- Keep this package as glue only. Server and request-handler helpers delegate to
  `@contentful/optimization-node`; client exports delegate to `@contentful/optimization-react-web`.
- Do not import `@contentful/optimization-core` directly.
- Keep server entries free of client directives and browser-only assumptions.
- Keep client entries marked with `"use client"` and free of Node-only imports.
- Next.js middleware/proxy helpers in this package MUST be safely chainable. When an existing
  `NextResponse` is provided, preserve it and all non-SDK chain state on it: rewrites, redirects,
  cookies, response headers, and request overrides encoded in `x-middleware-override-headers` plus
  `x-middleware-request-*`. Only remove or replace SDK-owned request context such as `x-ctfl-opt-*`,
  and always cover composition with a prior `NextResponse.next({ request: { headers } })` in tests.

## Commands

- `pnpm --filter @contentful/optimization-nextjs <script>` with `typecheck`, `test:unit`, `build`,
  `size:check`, or `size:report`.

## Validate

- Run `typecheck`, `test:unit`, and `build`.
- Run `size:check` and handle failures under the root `Bundle size` policy.
