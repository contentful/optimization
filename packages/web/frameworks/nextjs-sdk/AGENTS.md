# AGENTS.md

Next.js adapter package for composing lower-layer Optimization SDK behavior with Next.js router and
runtime ergonomics.

## Rules

- Keep this package as glue only. Server, request-handler, client, and edge helpers delegate to the
  SDK layer that owns the behavior. Import lower-layer helpers directly only when this package's
  public dependency contract declares that dependency; otherwise use the direct SDK dependency's
  public pass-through entrypoints.
- Keep router-specific bound-component binding helpers explicit. App Router components live under
  `@contentful/optimization-nextjs/app-router`; Pages Router components live under
  `@contentful/optimization-nextjs/pages-router`; low-level server, edge, or client capabilities
  should be exposed from the canonical entrypoint for the capability instead of adding overlapping
  aliases.
- The package root is intentionally unexported; do not add a bound component helper or client alias
  there.
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
