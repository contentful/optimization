# Next.js Pages Router (`@contentful/optimization-nextjs`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only Pages-Router specifics.
App Router surface: see [`nextjs-app-router.md`](./nextjs-app-router.md).

## Package & entry points

| Import path                                           | Purpose                                                                                                                                                                                                                      | source                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-nextjs/pages-router`        | **Client** factory → bound `OptimizationRoot`, `OptimizationProvider`, `OptimizedEntry`, `NextPagesAutoPageTracker`. Exports the factory + `NextPagesAutoPageTracker` + bound types (React Web hooks import from `/client`). | `nextjs-sdk#pages-router.ts#createNextjsPagesRouterOptimization`; `nextjs-sdk#pages-router.ts#NextPagesAutoPageTracker`                                                                                                                                                                   |
| `@contentful/optimization-nextjs/pages-router/server` | **Server** factory → `getServerSideOptimizationProps`; also exports `prefetchOptimizedEntries`, `OptimizedEntryPrefetchDescriptor`, `ServerOptimizedEntryHandoff`                                                            | `nextjs-sdk#pages-router-server.ts#getServerSideOptimizationProps`; `nextjs-sdk#pages-router-server.ts#prefetchOptimizedEntries`; `core-sdk#OptimizedEntrySourceController.ts#OptimizedEntryPrefetchDescriptor`; `core-sdk#OptimizedEntrySourceController.ts#ServerOptimizedEntryHandoff` |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks + per-entry controls                                                                                                                                                                                      | `nextjs-sdk#client.ts`; `nextjs-sdk#../package.json`                                                                                                                                                                                                                                      |
| `@contentful/optimization-nextjs/server`              | Manual server SDK control (escape hatches)                                                                                                                                                                                   | `nextjs-sdk#server.tsx`; `nextjs-sdk#../package.json`                                                                                                                                                                                                                                     |
| `@contentful/optimization-nextjs/api-schemas`         | Type guards `isMergeTagEntry`, `isResolvedContentfulEntry`                                                                                                                                                                   | `nextjs-sdk#api-schemas.ts`; `api-schemas#contentful/typeGuards.ts#isMergeTagEntry`; `api-schemas#contentful/typeGuards.ts#isResolvedContentfulEntry`                                                                                                                                     |

Note: `/pages-router` and `/pages-router/server` export DIFFERENT functions both named
`createNextjsPagesRouterOptimization`.

The package root (`@contentful/optimization-nextjs`) is not an import path — the `package.json`
exports map starts at `./app-router`, with no `.` entry. `/pages-router` exports the factory,
tracker, and bound types only; import React Web hooks/providers from `/client`. (A `'use client'`
module cannot wildcard-re-export React Web without breaking Next.js 15 builds.)
source: `nextjs-sdk#../package.json`; `nextjs-sdk#pages-router.ts#createNextjsPagesRouterOptimization`.

## Setup / factory

- **Client:** `createNextjsPagesRouterOptimization(config)` →
  `{ OptimizationRoot, OptimizationProvider, OptimizedEntry, NextPagesAutoPageTracker }`. Config
  `NextjsPagesRouterOptimizationComponentsConfig` passes through to react-web `OptimizationRoot`
  props: `clientId`, `environment`, `locale`, `api?`, `defaults` (`consent`, `persistenceConsent`),
  `trackEntryInteraction?`, `liveUpdates?`, `app` (`name`, `version`), `logLevel?`. **The client
  factory strips `contentful` from the config** it forwards (`toClientRootConfig` /
  `toClientProviderConfig` destructure `contentful: _contentful`), so managed fetching on the client
  is not wired here; server-side prefetch is the Pages Router managed path (see below).
  source: `nextjs-sdk#pages-router.ts#createNextjsPagesRouterOptimization`; `nextjs-sdk#pages-router.ts#toClientRootConfig`; `nextjs-sdk#pages-router.ts#toClientProviderConfig`.
- **Server:** `createNextjsPagesRouterOptimization(config)` → `{ getServerSideOptimizationProps }`.
  source: `nextjs-sdk#pages-router-server.ts#createNextjsPagesRouterOptimization`.
  - Config `NextjsPagesRouterOptimizationConfig extends OptimizationNodeConfig`. **Requires**
    `server.consent` — a `CoreStatelessRequestConsent` value OR
    `(context: GetServerSidePropsContext) => CoreStatelessRequestConsent | Promise<...>`.
    source: `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterOptimizationConfig`; `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterServerConsentResolver`; `core-sdk#CoreStatelessRequest.ts#CoreStatelessRequestConsent`.
  - Optional `cookie?` (`domain`, `expires` in days → maxAge seconds).
    source: `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterOptimizationConfig`; `nextjs-sdk#pages-router-server.ts#toAnonymousIdCookieOptions`.
  - **`contentful?: ContentfulConfig` (managed fetching):** via `OptimizationNodeConfig` → core
    `contentful` config; enables server-side managed fetch through the request optimization instance
    (`requestOptimization.fetchOptimizedEntry(id)`) and the `prefetchOptimizedEntries` option below.
    source: `core-sdk#CoreBase.ts#CoreConfig`; `core-sdk#CoreBase.ts#ContentfulConfig`; `core-sdk#CoreStatelessRequest.ts#fetchOptimizedEntry`.
  - Consent resolver reads cookies as `context.req.cookies[NAME]` (NOT App Router's `cookies.get()`).
    source: `nextjs-sdk#pages-router-server.ts#createPagesRouterCookieReader`; `impl:nextjs-sdk_pages-router#lib/optimization-server.ts`.
  - `getServerSideOptimizationProps(context, options?)` return shape:
    `{ props: { contentfulOptimization: { clientDefaults?, initialPageEvent, serverOptimizationState?, serverOptimizedEntries? } }, data, requestOptimization }`.
    `clientDefaults` + `serverOptimizationState` + `serverOptimizedEntries` optional;
    `initialPageEvent` required. Also writes the anonymous-id `Set-Cookie`.
    source: `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterOptimizationPropsResult`; `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterOptimizationPageProps`; `nextjs-sdk#pages-router-server.ts#getNextjsPagesRouterOptimizationProps`; `nextjs-sdk#pages-router-server.ts#appendSetCookie`.
  - **`prefetchOptimizedEntries` option:** `options.prefetchOptimizedEntries?: readonly`
    `OptimizedEntryPrefetchDescriptor[]` (`{ entryId, entryQuery? }`). When present, the server
    calls `prefetchOptimizedEntries(requestOptimization, descriptors)` and puts the resulting
    `ServerOptimizedEntryHandoff[]` (each `{ entryId, entryQuery?, baselineEntry }`) into
    `contentfulOptimization.serverOptimizedEntries`, which `OptimizationRoot` forwards to
    react-web's `serverOptimizedEntries` prop so managed-`entryId` entries hydrate without a client
    fetch.
    source: `nextjs-sdk#pages-router-server.ts#prefetchOptimizedEntries`; `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterOptimizationPropsOptions`; `core-sdk#OptimizedEntrySourceController.ts#prefetchOptimizedEntries`; `core-sdk#OptimizedEntrySourceController.ts#ServerOptimizedEntryHandoff`.

## Components & hooks

| Name                       | Kind      | Import path                      | Key props/args                                                                                                                                                               | Returns                                   | source                                                                                                                                    |
| -------------------------- | --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`         | component | `/pages-router`                  | `clientDefaults?`, `serverOptimizationState?`, `children`                                                                                                                    | `ReactElement`                            | `nextjs-sdk#pages-router.ts#OptimizationRoot`; `nextjs-sdk#pages-router.ts#BoundNextjsPagesRouterOptimizationRootProps`                   |
| `OptimizationProvider`     | component | `/pages-router`                  | same; internally wraps `LiveUpdatesProvider` (`globalLiveUpdates`)                                                                                                           | `ReactElement` / `null`                   | `nextjs-sdk#pages-router.ts#OptimizationProvider`                                                                                         |
| `OptimizedEntry`           | component | `/pages-router` (factory return) | discriminated union `baselineEntry` XOR `entryId` (+`entryQuery?`), render-prop child, `liveUpdates?`, `loadingFallback?`, `errorFallback?`, `onEntryError?`, tracking props | `ReactElement` / `null`                   | `nextjs-sdk#pages-router.ts#OptimizedEntry`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry`                            |
| `NextPagesAutoPageTracker` | component | `/pages-router`                  | `initialPageEvent?: 'emit' / 'skip'`, `getPagePayload?`                                                                                                                      | `null`                                    | `nextjs-sdk#pages-router.ts#NextPagesAutoPageTracker`; `react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker`                     |
| `useConsentState`          | hook      | `/client`                        | —                                                                                                                                                                            | consent state                             | `react-web-sdk#hooks/useOptimizationState.ts#useConsentState`                                                                             |
| `useProfileState`          | hook      | `/client`                        | —                                                                                                                                                                            | profile (`traits`)                        | `react-web-sdk#hooks/useOptimizationState.ts#useProfileState`                                                                             |
| `useOptimizationActions`   | hook      | `/client`                        | —                                                                                                                                                                            | `{ setConsent, identifyUser, resetUser }` | `react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions`                                                                    |
| `useOptimizationContext`   | hook      | `/client`                        | —                                                                                                                                                                            | `{ sdk }` (undefined until ready)         | `react-web-sdk#hooks/useOptimization.ts#useOptimizationContext`; `react-web-sdk#context/OptimizationContext.tsx#OptimizationContextValue` |
| `useMergeTagResolver`      | hook      | `/client`                        | —                                                                                                                                                                            | merge-tag resolver                        | `react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver`                                                                          |
| `useOptimizedEntry`        | hook      | `/client`                        | entry + options (same `baselineEntry` XOR `entryId` union)                                                                                                                   | resolved entry state                      | `react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntry`                                                                    |

Note: the hooks
(`useConsentState`/`useProfileState`/`useOptimizationActions`/`useOptimizationContext`/
`useMergeTagResolver`/`useOptimizedEntry`) import from `/client`, not `/pages-router` (which exports
the factory + tracker + types only).
source: `nextjs-sdk#pages-router.ts#createNextjsPagesRouterOptimization`; `nextjs-sdk#client.ts`.

Note: unlike App Router's bound `OptimizedEntry`, the Pages Router `OptimizedEntry` IS the react-web
component directly, so it accepts per-entry `liveUpdates`, `loadingFallback`, and the managed
`entryId`/`entryQuery`/`errorFallback`/`onEntryError` props. Double-wrapping the same baseline id
returns null + a dev warning.
source: `nextjs-sdk#pages-router.ts#OptimizedEntry`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps`.

## Render / entry resolution

- Render prop `(resolvedEntry: Entry, { getMergeTagValue }) => ReactNode`; `resolvedEntry` is a base
  `contentful` `Entry` ⇒ cast `resolved as YourType` for narrower component types
  (`as unknown as YourType` only for genuinely disjoint). Baseline-fallback contract: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: `react-web-sdk#optimized-entry/optimizedEntryUtils.ts#RenderProp`; `react-web-sdk#optimized-entry/optimizedEntryUtils.ts#OptimizedEntryRenderContext`.
- Merge tags: guard embedded nodes with `isMergeTagEntry`; pass node `target` to `getMergeTagValue`.
  source: `api-schemas#contentful/typeGuards.ts#isMergeTagEntry`; `core-sdk#CoreBase.ts#getMergeTagValue`.

## Identifier ownership

| Identifier                                               | Owner  | Notes                                                                                                                                                                           | source                                                                                                                                                                  |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie)                  | SDK    | Written by server props helper via `Set-Cookie`; must NOT be `HttpOnly` (browser reads it)                                                                                      | `core-sdk#constants.ts#ANONYMOUS_ID_COOKIE`; `nextjs-sdk#server.tsx#DEFAULT_NEXTJS_ANONYMOUS_ID_COOKIE`; `nextjs-sdk#cookies.ts#createNextjsAnonymousIdSetCookieHeader` |
| app consent cookie (e.g. `personalizationConsentCookie`) | reader | Reader names/writes/reads; SDK only calls `server.consent` and personalizes on the result                                                                                       | `impl:nextjs-sdk_pages-router#lib/config.ts`; `impl:nextjs-sdk_pages-router#lib/optimization-server.ts`                                                                 |
| `NEXT_PUBLIC_*` env vars                                 | reader | Next.js exposes only `NEXT_PUBLIC_`-prefixed vars to the browser                                                                                                                | `extern:Next.js exposes only NEXT_PUBLIC_-prefixed vars to the browser`                                                                                                 |
| preview-panel enable flag                                | reader | Reader-owned, gated on a browser env var; the guide uses the standard `NEXT_PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` prefix (the ref impl's bare `PUBLIC_...` is non-standard) | `impl:nextjs-sdk_pages-router#lib/config.ts`                                                                                                                            |

## Events & tracking

- Page events: `NextPagesAutoPageTracker` emits on navigation; reads route via `useRouter` (NOT
  `useSearchParams`) ⇒ **no `Suspense` boundary needed** (App Router's tracker does need it).
  source: `react-web-sdk#router/next-pages.tsx#NextPagesAutoPageTracker`.
- `getPagePayload` callback receives `AutoPageEmissionContext<NextPagesAutoPageContext>` =
  `{ context, routeKey, isInitialEmission }`. Route fields (`pathname`, `asPath`, `query`, `router`,
  `routeKey`) are nested under `.context`, NOT top-level ⇒ destructure
  `({ context: { pathname } }) => ...`. Arbitrary `properties` keys are allowed (`Page` is
  `z.catchall(z.json())`).
  source: `react-web-sdk#auto-page/types.ts#AutoPageEmissionContext`; `react-web-sdk#router/next-pages.tsx#NextPagesAutoPageContext`; `react-web-sdk#auto-page/pagePayload.ts#buildAutoPagePayload`; `api-schemas#experience/event/properties/Page.ts#Page`; `core-sdk#events/EventBuilder.ts#PageViewBuilderArgs`.
- Duplicate-page-event control: `initialPageEvent: 'emit' | 'skip'`. Server auto-resolves to
  `'skip'` when data present AND event consent, else `'emit'`; overridable via 2nd arg. Flows
  through `contentfulOptimization.initialPageEvent` → tracker prop.
  source: `nextjs-sdk#pages-router-server.ts#NextjsPagesRouterInitialPageEvent`; `nextjs-sdk#pages-router-server.ts#resolveInitialPageEvent`; `nextjs-sdk#pages-router-server.ts#toContentfulOptimizationProps`.
- Interaction tracking (views/clicks/hovers): on by default with `OptimizedEntry`; opt out per-type
  via factory `trackEntryInteraction`; uses resolved entry id.
  source: `impl:nextjs-sdk_pages-router#lib/optimization.ts`.

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence).
- Server-derived client defaults: `server.consent` value/resolver → `resolveClientDefaults` maps to
  `{ consent, persistenceConsent }` → `contentfulOptimization.clientDefaults` →
  `OptimizationRoot clientDefaults`, so the browser starts in the same consent state the server used.
  source: `nextjs-sdk#pages-router-server.ts#resolveClientDefaults`; `nextjs-sdk#pages-router.ts#resolveClientDefaults`.

## Version / runtime quirks

- **No proxy/middleware.** Server identity + resolution + `Set-Cookie` all happen inside
  `getServerSideProps` via `getServerSideOptimizationProps(context)`.
  source: `nextjs-sdk#pages-router-server.ts#getNextjsPagesRouterOptimizationProps`; `nextjs-sdk#pages-router-server.ts#appendSetCookie`.
- `getServerSideProps` is already per-request dynamic — no static/ISR conflict; the page is the
  request boundary. (Contrast App Router, where server personalization forces a route dynamic.)
  source: `extern:Next.js getServerSideProps runs per request (never statically pre-rendered)`.
- `_app.tsx` is the mount point for `OptimizationRoot` + tracker (reads
  `pageProps.contentfulOptimization`). source: `impl:nextjs-sdk_pages-router#pages/_app.tsx`.

## Failure & fallback behavior

- Baseline fallback: see [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- **Experience API failure inside `getServerSideProps` REJECTS the request ⇒ 500** (no internal
  try/catch to baseline): `page()` → `sendAllowedExperienceEvent` awaits `upsertProfile` with no
  catch. Reader should wrap `getServerSideOptimizationProps` in try/catch and render baseline on
  failure. Denied consent short-circuits to `{ accepted: false }` with no API call.
  source: `core-sdk#CoreStatelessRequest.ts#page`; `core-sdk#CoreStatelessRequest.ts#sendAllowedExperienceEvent`.
- All-locale payloads (`withAllLocales` / `locale=*`) ⇒ baseline. Model: see
  [`../shared/concepts.md`](../shared/concepts.md#entry-resolution).
  source: `kb:shared/concepts.md`.
