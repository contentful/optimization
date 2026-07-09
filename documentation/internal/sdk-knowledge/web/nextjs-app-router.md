# Next.js App Router (`@contentful/optimization-nextjs`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only App-Router specifics.
Pages Router surface: see [`nextjs-pages-router.md`](./nextjs-pages-router.md). Facts here are
verified against `packages/web/frameworks/nextjs-sdk/src` and its `react-web-sdk`/`core-sdk`
dependencies; each carries a symbol-anchored source pointer.

## Package & entry points

| Import path                                   | Purpose                                                                                 | source                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/app-router`  | Factory → bound `OptimizationRoot`, `OptimizedEntry`, `NextAppAutoPageTracker`, `proxy` | `nextjs-sdk#app-router-server.tsx#createNextjsAppRouterOptimization`; `nextjs-sdk#app-router-server.tsx#NextjsOptimizationComponents`                 |
| `@contentful/optimization-nextjs/client`      | Browser-only hooks + per-entry live-update controls (`'use client'`)                    | `nextjs-sdk#client.ts`                                                                                                                                |
| `@contentful/optimization-nextjs/server`      | Manual server SDK control (advanced routes)                                             | `nextjs-sdk#server.tsx#createNextjsOptimization`                                                                                                      |
| `@contentful/optimization-nextjs/api-schemas` | Type guards `isMergeTagEntry`, `isResolvedContentfulEntry`                              | `nextjs-sdk#api-schemas.ts`; `api-schemas#contentful/typeGuards.ts#isMergeTagEntry`; `api-schemas#contentful/typeGuards.ts#isResolvedContentfulEntry` |

Note: `/app-router` has a `react-server` export condition (server build) distinct from its browser
build — the two builds are separate source entries.
source: `nextjs-sdk#app-router-server.tsx`; `nextjs-sdk#app-router-client.ts`

The package root (`@contentful/optimization-nextjs`) is not an import path — the `package.json`
exports map starts at `./app-router`, with no `.` entry. React Web hooks/providers import from
`/client`; the bound `OptimizationRoot` / `OptimizedEntry` / `NextAppAutoPageTracker` import from
`/app-router`.
source: `nextjs-sdk#package.test.ts`; `nextjs-sdk#app-router-server.tsx#NextjsOptimizationComponents`

## Setup / factory

- `createNextjsAppRouterOptimization(config)` →
  `{ proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizationProvider, OptimizedEntry }`.
  Config keys: `clientId`, `environment`, `locale`, `api?`, `defaults` (`consent`,
  `persistenceConsent`), `server` (`enabled`, `consent` — value or `({ cookies }) => consent`),
  `app` (`name`, `version`), plus `liveUpdates?`, `trackEntryInteraction?`, `onStatesReady?`,
  `allowedEventTypes?`. Create bound components once.
  source: `nextjs-sdk#app-router-server.tsx#createNextjsAppRouterOptimization`; `nextjs-sdk#app-router-server.tsx#NextjsOptimizationComponents`; `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerOptions`
- **`contentful?: ContentfulConfig` (managed fetching):** via the core `contentful` config. Lets the
  bound server `OptimizedEntry` fetch by `entryId` (via
  `sdk.fetchOptimizedEntry(entryId, { query })`) as an alternative to a manual `baselineEntry`. The
  factory strips `contentful` before building the CLIENT provider config (`toClientProviderConfig`
  destructures `contentful: _contentful`); managed fetching runs on the server side.
  source: `nextjs-sdk#app-router-server.tsx#resolveManagedServerOptimizedEntry`; `nextjs-sdk#app-router-server.tsx#toClientProviderConfig`; `core-sdk#CoreBase.ts#ContentfulConfig`; `core-sdk#CoreBase.ts#fetchOptimizedEntry`

## Components & hooks

| Name                                                                                     | Kind      | Import path           | Key props/args                                                                                                                                                         | Returns                                   | source                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | --------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                                                                       | component | `/app-router` (bound) | `children` (takes no per-render config)                                                                                                                                | element                                   | `nextjs-sdk#app-router-server.tsx#OptimizationRoot`; `nextjs-sdk#bound-component-types.ts#BoundNextjsOptimizationRootProps`                                                                                                                                     |
| `OptimizedEntry`                                                                         | component | `/app-router` (bound) | discriminated union `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed server fetch); render-prop child. Omits per-render `liveUpdates`/`loadingFallback` | element / `null`                          | `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#bound-component-types.ts#NextjsBoundOptimizedEntryProps`                                                                                                                                         |
| `OptimizedEntry`                                                                         | component | `/client`             | adds per-entry `liveUpdates`, `loadingFallback` (+ `errorFallback`/`onEntryError` for managed)                                                                         | element / `null`                          | `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry`                                                                                                                                                                                               |
| `NextAppAutoPageTracker`                                                                 | component | `/app-router`         | `initialPageEvent`, `getPagePayload`; needs `Suspense` (reads `useSearchParams`)                                                                                       | element                                   | `react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker`                                                                                                                                                                                                      |
| `useOptimizationActions`                                                                 | hook      | `/client`             | —                                                                                                                                                                      | `{ setConsent, identifyUser, resetUser }` | `react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions`; `react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult`                                                                                                            |
| `useConsentState` / `useProfileState` / `useOptimizationContext` / `useMergeTagResolver` | hook      | `/client`             | —                                                                                                                                                                      | state / `{ sdk }` / resolver              | `react-web-sdk#hooks/useOptimizationState.ts#useConsentState`; `react-web-sdk#hooks/useOptimizationState.ts#useProfileState`; `react-web-sdk#hooks/useOptimization.ts#useOptimizationContext`; `react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver` |

Note: bound `/app-router` `OptimizedEntry` omits per-entry `liveUpdates`/`loadingFallback` so the
same import type-checks in Server + Client Components; use `/client` `OptimizedEntry` for per-entry
control.
source: `nextjs-sdk#bound-component-types.ts#NextjsBoundOptimizedEntryProps`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntryProps`

## Render / entry resolution

- Render prop hands back a base `contentful` `Entry`; cast `resolved as YourType`
  (`as unknown as YourType` only for genuinely disjoint types). Baseline-fallback contract: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). Double-wrapping the same
  baseline id renders `null` + dev warning.
  source: `react-web-sdk#optimized-entry/optimizedEntryUtils.ts#OptimizedEntryRenderContext`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#useDuplicateBaselineGuard`

## Identifier ownership

| Identifier                              | Owner  | Notes                                                         | source                                                                                                                                                        |
| --------------------------------------- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Written by `proxy`; must NOT be `HttpOnly` (browser reads it) | `core-sdk#constants.ts#ANONYMOUS_ID_COOKIE`; `nextjs-sdk#server.tsx#persistNextjsAnonymousId`; `nextjs-sdk#cookies.ts#createNextjsAnonymousIdSetCookieHeader` |
| app consent cookie                      | reader | Reader names/writes/reads; SDK only calls `server.consent`    | `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentResolver`; `nextjs-sdk#request-handler.ts#resolveServerConsent`                           |
| `NEXT_PUBLIC_*` env vars                | reader | Next.js exposes only `NEXT_PUBLIC_`-prefixed vars to browser  | `extern:Next.js exposes only NEXT_PUBLIC_-prefixed vars to the browser`                                                                                       |

## Events & tracking

- `NextAppAutoPageTracker` must stay inside `Suspense` (reads `useSearchParams`).
  Duplicate-page-event control: `initialPageEvent="skip"` when the server already reported the view,
  `"emit"` for browser-owned routes.
  source: `react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker`; `react-web-sdk#auto-page/useAutoPageEmitter.ts#InitialAutoPageEvent`
- Interaction tracking on by default with `OptimizedEntry`; opt out via factory
  `trackEntryInteraction`; uses resolved entry id.
  source: `react-web-sdk#provider/OptimizationProvider.tsx#TrackEntryInteractionOptions`; concept:interaction-tracking-in-web-sdks

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Per-request
  `server.consent` reads request `cookies.get(NAME)`; browser seeded via `defaults`.
  source: `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentContext`; `nextjs-sdk#app-router-server.tsx#resolveClientDefaults`

## Version / runtime quirks

- **Request-handler filename/export is Next.js-version-specific:** Next.js 16 loads a `proxy` export
  from `proxy.ts`; Next.js 15 loads a `middleware` export from `middleware.ts` (alias
  `export { proxy as middleware }`). Wrong filename/export ⇒ handler silently never runs, and with
  `server.enabled: true` the bound root THROWS (not baseline).
  source: `nextjs-sdk#app-router-server.tsx#loadServerData`; `nextjs-sdk#request-handler.ts#createNextjsOptimizationContextHandler`; `extern:Next.js 16 loads a proxy export from proxy.ts whereas Next.js 15 loads a middleware export from middleware.ts`
- **Server personalization forces dynamic rendering:** bound server components read `headers()` ⇒
  route can no longer use `revalidate` / `generateStaticParams` (ISR/SSG).
  source: `nextjs-sdk#app-router-server.tsx#loadServerData`; `extern:calling next/headers headers() opts a route into dynamic rendering, disabling revalidate and generateStaticParams`

## Failure & fallback behavior

- Baseline fallback on denied consent / no variant / unresolved links / all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). With `server.enabled: true`, a
  missing/misnamed request handler makes the bound root throw rather than fall back.
  source: `nextjs-sdk#app-router-server.tsx#loadServerData`; `nextjs-sdk#app-router-server.tsx#isAutomaticServerOptimizationData`
