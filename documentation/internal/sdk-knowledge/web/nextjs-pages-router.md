# Next.js Pages Router (`@contentful/optimization-nextjs`) — SDK knowledge

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only Pages-Router specifics.
App Router surface: see [`nextjs-app-router.md`](./nextjs-app-router.md).

## Package & entry points

| Import path                                           | Purpose                                                                                                                                                                                                                      | source                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `@contentful/optimization-nextjs/pages-router`        | **Client** factory → bound `OptimizationRoot`, `OptimizationProvider`, `OptimizedEntry`, `NextPagesAutoPageTracker`. Exports the factory + `NextPagesAutoPageTracker` + bound types (React Web hooks import from `/client`). | `src/pages-router.ts:29-33, 50, 96-101` (`'use client'` line 1) |
| `@contentful/optimization-nextjs/pages-router/server` | **Server** factory → `getServerSideOptimizationProps`; also exports `prefetchOptimizedEntries`, `OptimizedEntryPrefetchDescriptor`, `ServerOptimizedEntryHandoff`                                                            | `src/pages-router-server.ts:36-40, 85`                          |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks + per-entry controls                                                                                                                                                                                      | `src/client.ts`; `package.json` exports                         |
| `@contentful/optimization-nextjs/server`              | Manual server SDK control (escape hatches)                                                                                                                                                                                   | `src/server.tsx`; `package.json` exports                        |
| `@contentful/optimization-nextjs/api-schemas`         | Type guards `isMergeTagEntry`, `isResolvedContentfulEntry`                                                                                                                                                                   | `src/api-schemas.ts`                                            |

Note: `/pages-router` and `/pages-router/server` export DIFFERENT functions both named
`createNextjsPagesRouterOptimization`.

The package root (`@contentful/optimization-nextjs`) is not an import path — the `package.json`
exports map starts at `./app-router`, with no `.` entry. `/pages-router` exports the factory,
tracker, and bound types only; import React Web hooks/providers from `/client`. (A `'use client'`
module cannot wildcard-re-export React Web without breaking Next.js 15 builds.) source:
`nextjs-sdk/package.json` exports; `src/pages-router.ts:29-33`.

## Setup / factory

- **Client:** `createNextjsPagesRouterOptimization(config)` →
  `{ OptimizationRoot, OptimizationProvider, OptimizedEntry, NextPagesAutoPageTracker }`. Config
  `NextjsPagesRouterOptimizationComponentsConfig` passes through to react-web `OptimizationRoot`
  props: `clientId`, `environment`, `locale`, `api?`, `defaults` (`consent`, `persistenceConsent`),
  `trackEntryInteraction?`, `liveUpdates?`, `app` (`name`, `version`), `logLevel?`. **The client
  factory strips `contentful` from the config** it forwards (`toClientRootConfig` /
  `toClientProviderConfig` destructure `contentful: _contentful`), so managed fetching on the client
  is not wired here; server-side prefetch is the Pages Router managed path (see below). source:
  `src/pages-router.ts:51-99, 104-118`.
- **Server:** `createNextjsPagesRouterOptimization(config)` → `{ getServerSideOptimizationProps }`.
  source: `src/pages-router-server.ts:85-99`.
  - Config `NextjsPagesRouterOptimizationConfig extends OptimizationNodeConfig`. **Requires**
    `server.consent` — a `CoreStatelessRequestConsent` value OR
    `(context: GetServerSidePropsContext) => CoreStatelessRequestConsent | Promise<...>`. source:
    `src/pages-router-server.ts:56-65, 308-313`.
  - Optional `cookie?` (`domain`, `expires` in days → maxAge seconds). source:
    `src/pages-router-server.ts:56-57, 293-306`.
  - **`contentful?: ContentfulConfig` (managed fetching):** via `OptimizationNodeConfig` → core
    `contentful` config; enables server-side managed fetch through the request optimization instance
    (`requestOptimization.fetchOptimizedEntry(id)`) and the `prefetchOptimizedEntries` option below.
    source: `core-sdk` `CoreBase.ts:173` (`CoreConfig.contentful`).
  - Consent resolver reads cookies as `context.req.cookies[NAME]` (NOT App Router's
    `cookies.get()`). source: `src/pages-router-server.ts:52-54`; ref impl
    `lib/optimization-server.ts:16-19`.
  - `getServerSideOptimizationProps(context, options?)` return shape:
    `{ props: { contentfulOptimization: { clientDefaults?, initialPageEvent, serverOptimizationState?, serverOptimizedEntries? } }, data, requestOptimization }`.
    `clientDefaults` + `serverOptimizationState` + `serverOptimizedEntries` optional;
    `initialPageEvent` required. Also writes the anonymous-id `Set-Cookie`. source:
    `src/pages-router-server.ts:41-49, 72-76, 101-149, 233-258`.
  - **`prefetchOptimizedEntries` option:** `options.prefetchOptimizedEntries?: readonly`
    `OptimizedEntryPrefetchDescriptor[]` (`{ entryId, entryQuery? }`). When present, the server
    calls `prefetchOptimizedEntries(requestOptimization, descriptors)` and puts the resulting
    `ServerOptimizedEntryHandoff[]` (each `{ entryId, entryQuery?, baselineEntry }`) into
    `contentfulOptimization.serverOptimizedEntries`, which `OptimizationRoot` forwards to
    react-web's `serverOptimizedEntries` prop so managed-`entryId` entries hydrate without a client
    fetch. source: `src/pages-router-server.ts:36-40, 59, 121-149, 253-258`; `core-sdk`
    `OptimizedEntrySourceController.ts:98-101`.

## Components & hooks

| Name                       | Kind      | Import path                      | Key props/args                                                                                                                                                               | Returns                                   | source                                                                |
| -------------------------- | --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `OptimizationRoot`         | component | `/pages-router`                  | `clientDefaults?`, `serverOptimizationState?`, `children`                                                                                                                    | `ReactElement`                            | `src/pages-router.ts:37-71`                                           |
| `OptimizationProvider`     | component | `/pages-router`                  | same; internally wraps `LiveUpdatesProvider` (`globalLiveUpdates`)                                                                                                           | `ReactElement \| null`                    | `src/pages-router.ts:73-91`                                           |
| `OptimizedEntry`           | component | `/pages-router` (factory return) | discriminated union `baselineEntry` XOR `entryId` (+`entryQuery?`), render-prop child, `liveUpdates?`, `loadingFallback?`, `errorFallback?`, `onEntryError?`, tracking props | `ReactElement \| null`                    | `src/pages-router.ts:100` (= react-web `OptimizedEntry`)              |
| `NextPagesAutoPageTracker` | component | `/pages-router`                  | `initialPageEvent?: 'emit'\|'skip'`, `getPagePayload?`                                                                                                                       | `null`                                    | `src/pages-router.ts:30`; react-web `src/router/next-pages.tsx:53-58` |
| `useConsentState`          | hook      | `/client`                        | —                                                                                                                                                                            | consent state                             | react-web `hooks/useOptimizationState.ts:49`                          |
| `useProfileState`          | hook      | `/client`                        | —                                                                                                                                                                            | profile (`traits`)                        | react-web `hooks/useOptimizationState.ts:79`                          |
| `useOptimizationActions`   | hook      | `/client`                        | —                                                                                                                                                                            | `{ setConsent, identifyUser, resetUser }` | react-web `hooks/useOptimizationActions.ts:11-19,44-58`               |
| `useOptimizationContext`   | hook      | `/client`                        | —                                                                                                                                                                            | `{ sdk }` (undefined until ready)         | react-web `context/OptimizationContext.tsx:8`                         |
| `useMergeTagResolver`      | hook      | `/client`                        | —                                                                                                                                                                            | merge-tag resolver                        | react-web `hooks/useMergeTagResolver.ts`                              |
| `useOptimizedEntry`        | hook      | `/client`                        | entry + options (same `baselineEntry` XOR `entryId` union)                                                                                                                   | resolved entry state                      | react-web `optimized-entry/useOptimizedEntry.ts`                      |

Note: the hooks
(`useConsentState`/`useProfileState`/`useOptimizationActions`/`useOptimizationContext`/
`useMergeTagResolver`/`useOptimizedEntry`) import from `/client`, not `/pages-router` (which exports
the factory + tracker + types only). source: `src/pages-router.ts:29-33`.

Note: unlike App Router's bound `OptimizedEntry`, the Pages Router `OptimizedEntry` IS the react-web
component directly, so it accepts per-entry `liveUpdates` (`OptimizedEntry.tsx:60`),
`loadingFallback`, and the managed `entryId`/`entryQuery`/`errorFallback`/`onEntryError` props.
Double-wrapping the same baseline id returns null + a dev warning
(`OptimizedEntry.tsx:104-116, 164-166`).

## Render / entry resolution

- Render prop `(resolvedEntry: Entry, { getMergeTagValue }) => ReactNode`; `resolvedEntry` is a base
  `contentful` `Entry` ⇒ cast `resolved as YourType` for narrower component types
  (`as unknown as YourType` only for genuinely disjoint). source: react-web
  `optimized-entry/optimizedEntryUtils.ts:11`; `OptimizedEntry.tsx:36`. Baseline-fallback contract:
  see [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- Merge tags: guard embedded nodes with `isMergeTagEntry`; pass node `target` to `getMergeTagValue`.
  source: `core-sdk` `CoreBase.ts:213`; `test/typeGuards.ts:285`.

## Identifier ownership

| Identifier                                               | Owner  | Notes                                                                                                       | source                                                               |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie)                  | SDK    | Written by server props helper via `Set-Cookie`; must NOT be `HttpOnly` (browser reads it)                  | `core-sdk/constants.ts:38`; `server.tsx:18`; `cookies.ts:39-67, 105` |
| app consent cookie (e.g. `personalizationConsentCookie`) | reader | Reader names/writes/reads; SDK only calls `server.consent` and personalizes on the result                   | ref impl `lib/config.ts`, `lib/optimization-server.ts:16-19`         |
| `NEXT_PUBLIC_*` env vars                                 | reader | Next.js exposes only `NEXT_PUBLIC_`-prefixed vars to the browser                                            | Next.js convention                                                   |
| preview-panel enable flag                                | reader | Guide uses `NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL`; ref impl uses non-standard `PUBLIC_...` — DRIFT | ref impl `lib/config.ts:6`; see `../shared/consistency-notes.md`     |

## Events & tracking

- Page events: `NextPagesAutoPageTracker` emits on navigation; reads route via `useRouter` (NOT
  `useSearchParams`) ⇒ **no `Suspense` boundary needed** (App Router's tracker does need it).
  source: react-web `router/next-pages.tsx:3, 53-58`.
- `getPagePayload` callback receives `AutoPageEmissionContext<NextPagesAutoPageContext>` =
  `{ context, routeKey, isInitialEmission }`. Route fields (`pathname`, `asPath`, `query`, `router`,
  `routeKey`) are nested under `.context`, NOT top-level ⇒ destructure
  `({ context: { pathname } }) => ...`. source: react-web `auto-page/types.ts:10-19`,
  `router/next-pages.tsx:79-89`, `auto-page/pagePayload.ts:57`. Arbitrary `properties` keys are
  allowed (`Page` is `z.catchall(z.json())`; `api-schemas/.../Page.ts:13-46`;
  `EventBuilder.ts:219-221`).
- Duplicate-page-event control: `initialPageEvent: 'emit' | 'skip'`. Server auto-resolves to
  `'skip'` when data present AND event consent, else `'emit'`; overridable via 2nd arg. Flows
  through `contentfulOptimization.initialPageEvent` → tracker prop. source:
  `src/pages-router-server.ts:28, 48, 132, 251-260`.
- Interaction tracking (views/clicks/hovers): on by default with `OptimizedEntry`; opt out per-type
  via factory `trackEntryInteraction`; uses resolved entry id. source: ref impl
  `lib/optimization.ts:11`.

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence).
- Server-derived client defaults: `server.consent` value/resolver → `resolveClientDefaults` maps to
  `{ consent, persistenceConsent }` → `contentfulOptimization.clientDefaults` →
  `OptimizationRoot clientDefaults`, so the browser starts in the same consent state the server
  used. source: `src/pages-router-server.ts:262-275`; `src/pages-router.ts:114-124`.

## Version / runtime quirks

- **No proxy/middleware.** Server identity + resolution + `Set-Cookie` all happen inside
  `getServerSideProps` via `getServerSideOptimizationProps(context)`. source:
  `src/pages-router-server.ts:101-137`.
- `getServerSideProps` is already per-request dynamic — no static/ISR conflict; the page is the
  request boundary. (Contrast App Router, where server personalization forces a route dynamic.)
- `_app.tsx` is the mount point for `OptimizationRoot` + tracker (reads
  `pageProps.contentfulOptimization`). source: ref impl `pages/_app.tsx:31-37`.

## Failure & fallback behavior

- Baseline fallback: see [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- **Experience API failure inside `getServerSideProps` REJECTS the request ⇒ 500** (no internal
  try/catch to baseline): `page()` → `sendAllowedExperienceEvent` awaits `upsertProfile` with no
  catch. Reader should wrap `getServerSideOptimizationProps` in try/catch and render baseline on
  failure. Denied consent short-circuits to `{ accepted: false }` with no API call. source:
  `core-sdk` `CoreStatelessRequest.ts:299-333`.
- All-locale payloads (`withAllLocales` / `locale=*`) ⇒ baseline. source: see
  [`../shared/concepts.md`](../shared/concepts.md#entry-resolution). </content>
