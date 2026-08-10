# AGENTS.md

Next.js adapter package for composing lower-layer Optimization SDK behavior with Next.js router and
runtime ergonomics.

## Rules

- Keep this package as glue only. Server, request-handler, client, and edge helpers delegate to the
  SDK layer that owns the behavior. Import lower-layer helpers directly only when this package's
  public dependency contract declares that dependency; otherwise use the direct SDK dependency's
  public pass-through entrypoints.
- Keep router-specific bound-component binding helpers explicit.
  `bindNextjsAppRouterServerOptimization()` and `NextjsAppRouterServerOptimization` live under
  `@contentful/optimization-nextjs/app-router/server`;
  `bindNextjsAppRouterClientOptimization()` and `NextjsAppRouterClientOptimization` live under
  `@contentful/optimization-nextjs/app-router/client`; Pages Router components live under
  `@contentful/optimization-nextjs/pages-router`.
- Use the server binding's `request` family for private request personalization. Keep its
  configuration server-only and make every request component await the same binder-owned request
  resource. Keep top-level server components and helpers explicit-input surfaces for static,
  public-permutation, analytics-only, and manual request flows; they must not read Next.js request
  APIs through the request family.
- The package root is intentionally unexported; do not add a bound component helper or client alias
  there.
- Export `getServerTrackingAttributes()` only from
  `@contentful/optimization-nextjs/tracking-attributes`, not from an App Router binding or bound
  result.
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
