<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Next.js SDK App Router Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

This reference implementation integrates `@contentful/optimization-nextjs` with the Next.js App
Router. It demonstrates request-bound personalization, public permutation handoff, analytics-only
rendering, Cache Components routes, and browser takeover without importing lower-level SDKs.

For a complete integration walkthrough, see
[Integrate the Optimization SDK in a Next.js App Router app](../../documentation/guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).
Edge runtime routes live in the
[Next.js App Router Edge runtime reference implementation](../nextjs-sdk_app-router_edge-runtime/README.md).

## What this covers

- A single server binding in `lib/optimization.ts`.
- Request-bound Server Components with browser hydration and live updates.
- Static public permutation and analytics-only handoff.
- App-owned and SDK-managed Contentful entry fetching.
- Preview panel attachment behind `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`.

Client Components beneath an App Router binding import context-bound hooks, providers,
`OptimizedEntry`, and related runtime types from
`@contentful/optimization-nextjs/app-router/client`. Do not use the generic
`@contentful/optimization-nextjs/client` entrypoint in that bound tree because the router-specific
facade keeps every consumer on the App Router runtime context.

## Forward requests

`proxy.ts` re-exports the app's forwarding handler and declares the routes that need Optimization
context:

```ts
export { proxy } from './lib/optimization'

export const config = {
  matcher: [
    '/',
    '/page-two',
    '/hidden-until-ready',
    '/static-shell-private-slot',
    '/selection-handoff/:path*',
    '/analytics-only/:path*',
  ],
}
```

Next.js 13 to 15 uses the same handler from `middleware.ts` with a `middleware` export. The linked
guide covers forwarding and trusted handoff options.

## Compose a private island

Keep public chrome outside `Suspense`, use a meaningful fallback, and call `connection()` only at
the private boundary. Managed prefetch overlaps the entry fetch with request initialization:

```tsx
export default function Page() {
  return (
    <AppShellChrome>
      <Suspense fallback={<PersonalizedContentFallback />}>
        <PrivateRequestSlot />
      </Suspense>
    </AppShellChrome>
  )
}

async function PrivateRequestSlot() {
  await connection()

  return (
    <RequestOptimizationRoot prefetchManagedEntries={[entryId]}>
      <RequestOptimizedEntry entryId={entryId}>{renderEntry}</RequestOptimizedEntry>
    </RequestOptimizationRoot>
  )
}
```

Keep provider-dependent tools inside `RequestOptimizationRoot`.

## Choose entry-fetch ownership

Use `baselineEntry` when the app owns Contentful queries and caching. Use `entryId` when the SDK
binding owns the fetch, and prefetch IDs at the request root when useful:

```tsx
<RequestOptimizedEntry baselineEntry={entry}>{renderEntry}</RequestOptimizedEntry>

<RequestOptimizationRoot prefetchManagedEntries={[entryId]}>
  <RequestOptimizedEntry entryId={entryId}>{renderEntry}</RequestOptimizedEntry>
</RequestOptimizationRoot>
```

## CDA locale handling

The reference app uses `appConfig.locale` for SDK configuration, event context, and Contentful CDA
fetches. Keep entries single-locale; don't use `withAllLocales` or `locale=*` for SDK entry
resolution. See
[Locale handling in the Optimization SDK Suite](../../documentation/concepts/locale-handling-in-the-optimization-sdk-suite.md).

## Prerequisites

- Node.js 24.15.0, matching `.nvmrc`.
- pnpm.

## Setup

Run these commands from the monorepo root:

```sh
pnpm install
pnpm build:pkgs
pnpm implementation:run -- nextjs-sdk_app-router implementation:install
test -f implementations/nextjs-sdk_app-router/.env || cp implementations/nextjs-sdk_app-router/.env.example implementations/nextjs-sdk_app-router/.env
```

The `.env.example` values target the shared local mock API. Replace them only when testing against
live services.

## Running locally

Run the development server on `http://localhost:3002`:

```sh
pnpm implementation:run -- nextjs-sdk_app-router dev
```

Run local checks from the monorepo root:

```sh
pnpm implementation:run -- nextjs-sdk_app-router typecheck
pnpm implementation:run -- nextjs-sdk_app-router lint
pnpm implementation:run -- nextjs-sdk_app-router build
```

## Running E2E tests

Run the run-only Playwright wrapper from the monorepo root. Pass a test file or filter for routine
validation; omit it only when the full suite is warranted:

```sh
pnpm test:e2e:nextjs-sdk_app-router <file-or-filter>
```

If consumed SDK packages changed or installed artifacts are stale, first run `pnpm build:pkgs` and
`pnpm implementation:run -- nextjs-sdk_app-router implementation:install`. Run
`pnpm setup:e2e:nextjs-sdk_app-router` only when the Playwright browser executable is missing.

## Related

- [Next.js SDK Pages Router](../nextjs-sdk_pages-router/README.md) - Pages Router reference
  implementation.
- [Next.js SDK App Router Edge runtime](../nextjs-sdk_app-router_edge-runtime/README.md) - Edge
  runtime reference implementation.
- [React Web SDK reference implementation](../react-web-sdk/README.md) - Browser-side React
  integration.
- [@contentful/optimization-nextjs](../../packages/web/frameworks/nextjs-sdk/README.md) - Package
  documentation.
- [Mocks package](../../lib/mocks/README.md) - Shared mock server and fixtures.
