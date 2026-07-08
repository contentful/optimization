# Next.js App Router (`@contentful/optimization-nextjs`) — SDK knowledge

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only App-Router specifics.
Pages Router surface: see [`nextjs-pages-router.md`](./nextjs-pages-router.md). Facts here are
sourced from the accepted App Router guide plus `src/app-router-*`; deepen with file:line evidence
when this SDK's guide is next revised.

## Package & entry points

| Import path                                   | Purpose                                                                                 | source                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router`  | Factory → bound `OptimizationRoot`, `OptimizedEntry`, `NextAppAutoPageTracker`, `proxy` | `src/app-router-server.tsx`; `package.json` exports |
| `@contentful/optimization-nextjs/client`      | Browser-only hooks + per-entry live-update controls (`'use client'`)                    | `src/client.ts`; `package.json` exports             |
| `@contentful/optimization-nextjs/server`      | Manual server SDK control (advanced routes)                                             | `src/server.tsx`; `package.json` exports            |
| `@contentful/optimization-nextjs/api-schemas` | Type guards `isMergeTagEntry`, `isResolvedContentfulEntry`                              | `src/api-schemas.ts`                                |

Note: `/app-router` has a `react-server` export condition (server build) distinct from its browser
build. source: `package.json` exports.

The package root (`@contentful/optimization-nextjs`) is not an import path — the `package.json`
exports map starts at `./app-router`, with no `.` entry. React Web hooks/providers import from
`/client`; the bound `OptimizationRoot` / `OptimizedEntry` / `NextAppAutoPageTracker` import from
`/app-router`. source: `nextjs-sdk/package.json` exports (no `.` entry).

## Setup / factory

- `createNextjsAppRouterOptimization(config)` →
  `{ proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizationProvider, OptimizedEntry }`.
  Config keys: `clientId`, `environment`, `locale`, `api?`, `defaults` (`consent`,
  `persistenceConsent`), `server` (`enabled`, `consent` — value or `({ cookies }) => consent`),
  `app` (`name`, `version`), plus `liveUpdates?`, `trackEntryInteraction?`, `onStatesReady?`,
  `allowedEventTypes?`. Create bound components once. source: `src/app-router-server.tsx:66-74,88`
  (5-member interface + factory).
- **`contentful?: ContentfulConfig` (managed fetching):** via the core `contentful` config. Lets the
  bound server `OptimizedEntry` fetch by `entryId` (via
  `sdk.fetchOptimizedEntry(entryId, { query })`) as an alternative to a manual `baselineEntry`. The
  factory strips `contentful` before building the CLIENT provider config (`toClientProviderConfig`
  destructures `contentful: _contentful`); managed fetching runs on the server side. source:
  `src/app-router-server.tsx:145-223,284`; `core-sdk` `CoreBase.ts:173`.

## Components & hooks

| Name                                                                                     | Kind      | Import path           | Key props/args                                                                                                                                                         | Returns                                   | source                                       |
| ---------------------------------------------------------------------------------------- | --------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `OptimizationRoot`                                                                       | component | `/app-router` (bound) | `children` (takes no per-render config)                                                                                                                                | element                                   | accepted App Router guide                    |
| `OptimizedEntry`                                                                         | component | `/app-router` (bound) | discriminated union `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed server fetch); render-prop child. Omits per-render `liveUpdates`/`loadingFallback` | element / `null`                          | `src/app-router-server.tsx:57-63,145-223`    |
| `OptimizedEntry`                                                                         | component | `/client`             | adds per-entry `liveUpdates`, `loadingFallback` (+ `errorFallback`/`onEntryError` for managed)                                                                         | element / `null`                          | react-web `OptimizedEntry.tsx:81-90,118-133` |
| `NextAppAutoPageTracker`                                                                 | component | `/app-router`         | `initialPageEvent`, `getPagePayload`; needs `Suspense` (reads `useSearchParams`)                                                                                       | element                                   | react-web `router/next-app.tsx:3, 51`        |
| `useOptimizationActions`                                                                 | hook      | `/client`             | —                                                                                                                                                                      | `{ setConsent, identifyUser, resetUser }` | accepted App Router guide                    |
| `useConsentState` / `useProfileState` / `useOptimizationContext` / `useMergeTagResolver` | hook      | `/client`             | —                                                                                                                                                                      | state / `{ sdk }` / resolver              | accepted App Router guide                    |

Note: bound `/app-router` `OptimizedEntry` omits per-entry `liveUpdates`/`loadingFallback` so the
same import type-checks in Server + Client Components; use `/client` `OptimizedEntry` for per-entry
control. source: accepted App Router guide.

## Render / entry resolution

- Render prop hands back a base `contentful` `Entry`; cast `resolved as YourType`
  (`as unknown as YourType` only for genuinely disjoint types). Baseline-fallback contract: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). Double-wrapping the same
  baseline id renders `null` + dev warning. source: accepted App Router guide.

## Identifier ownership

| Identifier                              | Owner  | Notes                                                         | source                                                                          |
| --------------------------------------- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Written by `proxy`; must NOT be `HttpOnly` (browser reads it) | `core-sdk/constants.ts:38`; `server.tsx:17`; not-HttpOnly in `cookies.ts:39-67` |
| app consent cookie                      | reader | Reader names/writes/reads; SDK only calls `server.consent`    | accepted App Router guide                                                       |
| `NEXT_PUBLIC_*` env vars                | reader | Next.js exposes only `NEXT_PUBLIC_`-prefixed vars to browser  | Next.js convention                                                              |

## Events & tracking

- `NextAppAutoPageTracker` must stay inside `Suspense` (reads `useSearchParams`).
  Duplicate-page-event control: `initialPageEvent="skip"` when the server already reported the view,
  `"emit"` for browser-owned routes. source: accepted App Router guide; react-web
  `router/next-app.tsx:3, 51`.
- Interaction tracking on by default with `OptimizedEntry`; opt out via factory
  `trackEntryInteraction`; uses resolved entry id. source: accepted App Router guide.

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Per-request
  `server.consent` reads request `cookies.get(NAME)`; browser seeded via `defaults`. source:
  accepted App Router guide.

## Version / runtime quirks

- **Request-handler filename/export is Next.js-version-specific:** Next.js 16 loads a `proxy` export
  from `proxy.ts`; Next.js 15 loads a `middleware` export from `middleware.ts` (alias
  `export { proxy as middleware }`). Wrong filename/export ⇒ handler silently never runs, and with
  `server.enabled: true` the bound root THROWS (not baseline). source: accepted App Router guide.
- **Server personalization forces dynamic rendering:** bound server components read `headers()` ⇒
  route can no longer use `revalidate` / `generateStaticParams` (ISR/SSG). source: accepted App
  Router guide.

## Failure & fallback behavior

- Baseline fallback on denied consent / no variant / unresolved links / all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). With `server.enabled: true`, a
  missing/misnamed request handler makes the bound root throw rather than fall back. source:
  accepted App Router guide. </content>
