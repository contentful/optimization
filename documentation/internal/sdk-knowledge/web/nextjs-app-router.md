# Next.js App Router (`@contentful/optimization-nextjs`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only App-Router specifics.
Pages Router surface: see [`nextjs-pages-router.md`](./nextjs-pages-router.md). Facts here are
verified against `packages/web/frameworks/nextjs-sdk/src` and its `react-web-sdk`/`core-sdk`
dependencies; each carries a symbol-anchored source pointer.

## Package & entry points

| Import path                                           | Purpose                                                                                                                                | source                                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-nextjs/app-router`          | Binding helper for bound roots, `OptimizedEntry`, route tracker, request/selection handoff helpers, cache middleware, tracking helpers | `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterOptimization`; `nextjs-sdk#app-router-client.ts#bindNextjsAppRouterOptimization`; `nextjs-sdk#app-router-server.tsx#NextjsOptimizationComponents` |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks + per-entry live-update controls (`'use client'`)                                                                   | `nextjs-sdk#client.ts`                                                                                                                                                                                 |
| `@contentful/optimization-nextjs/server`              | Manual server SDK control (advanced routes)                                                                                            | `nextjs-sdk#server.tsx#configureNextjsServerOptimization`                                                                                                                                              |
| `@contentful/optimization-nextjs/edge`                | Edge runtime request and public selection handoff helpers                                                                              | `nextjs-sdk#edge.ts#configureNextjsEdgeOptimization`; `nextjs-sdk#edge.ts#NextjsEdgeOptimization`                                                                                                      |
| `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request-context forwarding helper                                                                                | `nextjs-sdk#request-handler.ts#createNextjsOptimizationContextHandler`                                                                                                                                 |
| `@contentful/optimization-nextjs/tracking-attributes` | Server/static/edge `data-ctfl-*` tracking attributes                                                                                   | `nextjs-sdk#tracking-attributes.ts#getServerTrackingAttributes`                                                                                                                                        |
| `@contentful/optimization-nextjs/api-schemas`         | Type guards `isMergeTagEntry`, `isResolvedContentfulEntry`                                                                             | `nextjs-sdk#api-schemas.ts`; `api-schemas#contentful/typeGuards.ts#isMergeTagEntry`; `api-schemas#contentful/typeGuards.ts#isResolvedContentfulEntry`                                                  |

Note: `/app-router` has a `react-server` export condition (server build) distinct from its browser
build — the two builds are separate source entries.
source: `nextjs-sdk#app-router-server.tsx`; `nextjs-sdk#app-router-client.ts`

The package root (`@contentful/optimization-nextjs`) is not an import path — the `package.json`
exports map starts at `./app-router`, with no `.` entry. React Web hooks/providers import from
`/client`; the bound `OptimizationRoot` / `OptimizedEntry` / `NextAppAutoPageTracker` import from
`/app-router`.
source: `nextjs-sdk#package.test.ts`; `nextjs-sdk#app-router-server.tsx#NextjsOptimizationComponents`

## Setup / initialization and binding

- `bindNextjsAppRouterOptimization(config)` binds an app-level component/helper set. Binding calls
  are not request isolation boundaries; the server build shares request handoff state through React
  cache. Browser defaults are supplied through `consent.clientDefaults`; server/request consent is
  supplied through `consent.server`, which receives `{ cookies, headers }` and returns a boolean or
  event/persistence consent object.
  source: `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterOptimization`; `nextjs-sdk#app-router-server.tsx#getRequestHandoffStore`; `nextjs-sdk#bound-component-types.ts#NextjsOptimizationConsentConfig`; `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentResolver`
- `api.experienceBaseUrl` and `api.insightsBaseUrl` override the API clients' built-in production
  endpoints; omit them for the default hosts. `app: { name, version }` is attached to outgoing event
  context as application attribution metadata.
  source: `core-sdk#CoreApiConfig.ts#CoreSharedApiConfig`; `api-client#experience/ExperienceApiClient.ts#EXPERIENCE_BASE_URL`; `api-client#insights/InsightsApiClient.ts#INSIGHTS_BASE_URL`; `core-sdk#events/EventBuilder.ts#EventBuilderConfig`; `core-sdk#events/EventBuilder.ts#buildUniversalEventProperties`
- API clients default an omitted `environment` to `main`; an explicitly configured environment is
  used as supplied. Guides should still show the value when the reader must make project targeting
  unambiguous.
  source: `api-client#ApiClientBase.ts#DEFAULT_ENVIRONMENT`; `api-client#ApiClientBase.ts#ApiClientBase`
- **`contentful?: ContentfulConfig` (managed fetching):** via the core `contentful` config. Lets the
  bound server `OptimizedEntry` fetch by `entryId` (via
  `sdk.fetchOptimizedEntry(entryId, { query })`) as an alternative to a manual `baselineEntry`. The
  binding does not forward `contentful` to browser config; managed fetching runs on the server side.
  The bound `OptimizationRoot` / `OptimizationProvider` accept `hydration` plus
  `prefetchManagedEntries` descriptors; descriptors are fetched server-side through
  `sdk.prefetchManagedEntries()` and merged into `handoff.entries`.
  source: `nextjs-sdk#app-router-server.tsx#resolveManagedServerOptimizedEntry`; `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`; `nextjs-sdk#app-router-server.tsx#toClientProviderConfig`; `core-sdk#CoreBase.ts#ContentfulConfig`; `core-sdk#CoreBase.ts#prefetchManagedEntries`; `core-sdk#CoreBase.ts#fetchOptimizedEntry`
- A bound server `<OptimizedEntry entryId>` fetches and resolves that one server render but does not
  add its baseline entry to the browser handoff. A browser managed entry is seeded only when a
  matching `ManagedEntryHandoff` reaches the root through `handoff.entries` or is produced from the
  root's `prefetchManagedEntries` descriptors. Otherwise the browser has no Contentful
  client in its derived config and cannot infer the server component's managed fetch.
  source: `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#app-router-server.tsx#renderBoundRootTree`; `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`; `nextjs-sdk#app-router-server.tsx#toClientProviderConfig`; `react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries`
- Request handoff: the bound `createRequestHandoff(options)` binds the request, calls `page()`,
  builds a browser handoff, and sets `initialPageEvent` to `'skip'` exactly when
  `pageResult.accepted` is true; response data presence is not the page-event ownership signal.
  source: `nextjs-sdk#app-router-server.tsx#createRequestHandoff`; `nextjs-sdk#server.tsx#createNextjsRequestHandoff`
- Selection handoff: the bound `createHandoffFromSelections(input)` adds browser hydration metadata to
  the Core selection handoff. It is the App Router helper for customer-owned SSG, ISR, and public
  edge permutations; applications supply the selected optimizations, cache metadata, hydration mode,
  and initial page-event ownership.
  source: `nextjs-sdk#handoff.ts#createHandoffFromSelections`; `core-sdk#handoff.ts#createHandoffFromSelections`
- `resolveEntriesForSelections` is re-exported through the App Router binding so public/static
  selection renders can resolve multiple baseline entries with one selected-optimization set; shared
  behavior is recorded in [`../shared/concepts.md`](../shared/concepts.md#optimization-handoff).
  source: `nextjs-sdk#app-router-server.tsx#resolveEntriesForSelections`; `core-sdk#handoff.ts#resolveEntriesForSelections`
- `createOptimizationCacheKey` is re-exported through the App Router binding so public/static
  selection renders can build app-owned cache keys from scope, locale, baseline entry IDs, and
  selected optimizations.
  source: `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterOptimization`; `core-sdk#handoff.ts#createOptimizationCacheKey`
- `createCacheMiddleware(options)` rewrites only when `resolveCacheKey(request)` returns a key and an
  existing response does not already target a rewrite or redirect. Rewrites use the application
  `rewrite()` result, preserve forwarded request headers, and merge rewrite/forwarding headers back
  into an existing response when one is supplied.
  source: `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterOptimization`; `nextjs-sdk#cache-middleware.ts#createNextjsCacheMiddleware`; `nextjs-sdk#cache-middleware.ts#hasExistingTerminalMiddlewareTarget`; `nextjs-sdk#forwarded-request-headers.ts#createForwardedRequestHeaders`; `nextjs-sdk#forwarded-request-headers.ts#applyForwardedRequestHeaders`
- Analytics-only markup uses `OptimizationAnalyticsRoot` with a handoff whose hydration is
  `analytics-only`; server/static/edge markup attaches the same `data-ctfl-*` attributes produced by
  `getServerTrackingAttributes()`.
  source: `nextjs-sdk#app-router-server.tsx#OptimizationAnalyticsRoot`; `nextjs-sdk#tracking-attributes.ts#getServerTrackingAttributes`; `react-web-sdk#root/OptimizationAnalyticsRoot.tsx#OptimizationAnalyticsRoot`
- Edge runtime: `configureNextjsEdgeOptimization(config)` creates a stateless server-channel runtime
  with default allowed event types `['identify', 'page']` and event-builder library version from
  `OPTIMIZATION_NEXTJS_SDK_VERSION` unless caller library config overrides it.
  `createEdgeRequestHandoff(options)` reads cookies from a Next cookie reader or the raw `cookie`
  header, resolves server consent with cookies and headers, derives profile continuity from the
  anonymous-id cookie when no explicit profile is supplied, builds page context from
  URL/referrer/user-agent, emits `page()`, sets `initialPageEvent` from whether that page event was
  accepted, and returns `persist(response)` for the anonymous-id `Set-Cookie` append.
  source: `nextjs-sdk#edge.ts#configureNextjsEdgeOptimization`; `nextjs-sdk#edge.ts#createEdgeOptimizationRuntime`; `nextjs-sdk#constants.ts#OPTIMIZATION_NEXTJS_SDK_VERSION`; `nextjs-sdk#edge.ts#createEdgeRequestSnapshot`; `nextjs-sdk#edge.ts#createEdgeRequestContext`; `nextjs-sdk#edge.ts#createEdgeRequestOptimizationHandoff`; `nextjs-sdk#edge.ts#persistEdgeAnonymousId`
- Manual `/server` flow: `configureNextjsServerOptimization(config)` creates the long-lived
  stateless server runtime; `bindNextjsOptimizationRequest(sdk, options)` binds consent,
  request/page context, locale, and profile continuity to one request; `createNextjsRequestHandoff()`
  emits the page event and returns a browser handoff.
  `getServerTrackingAttributes(baselineEntry, resolvedData)` maps a manual resolution to the
  `data-ctfl-*` attributes browser interaction tracking consumes.
  source: `nextjs-sdk#server.tsx#configureNextjsServerOptimization`; `nextjs-sdk#server.tsx#bindNextjsOptimizationRequest`; `nextjs-sdk#server.tsx#createNextjsRequestHandoff`; `nextjs-sdk#server.tsx#persistNextjsAnonymousId`; `nextjs-sdk#server.tsx#ServerOptimizedEntry`; `nextjs-sdk#tracking-attributes.ts#getServerTrackingAttributes`

## Components & hooks

| Name                                                                                     | Kind      | Import path           | Key props/args                                                                                                                                                         | Returns                                   | source                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | --------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OptimizationRoot`                                                                       | component | `/app-router` (bound) | `children`; `handoff?`; `hydration?`; `prefetchManagedEntries?`; `routeKey?`; `buildPagePayload?`; `initialPagePayload?`                                               | element                                   | `nextjs-sdk#app-router-server.tsx#OptimizationRoot`; `nextjs-sdk#bound-component-types.ts#BoundNextjsOptimizationRootProps`                                                                                                                                     |
| `OptimizationProvider`                                                                   | component | `/app-router` (bound) | `children`; `handoff?`; `hydration?`; `prefetchManagedEntries?`                                                                                                        | element / `null`                          | `nextjs-sdk#app-router-server.tsx#OptimizationProvider`; `nextjs-sdk#bound-component-types.ts#BoundNextjsOptimizationProviderProps`                                                                                                                             |
| `OptimizationAnalyticsRoot`                                                              | component | `/app-router` (bound) | `handoff`; `routeKey`; `buildPagePayload`; `children`                                                                                                                  | element                                   | `nextjs-sdk#app-router-server.tsx#OptimizationAnalyticsRoot`; `nextjs-sdk#bound-component-types.ts#BoundNextjsOptimizationAnalyticsRootProps`                                                                                                                   |
| `OptimizedEntry`                                                                         | component | `/app-router` (bound) | discriminated union `baselineEntry` (manual) XOR `entryId` (+`entryQuery?`, managed server fetch); render-prop child. Omits per-render `liveUpdates`/`loadingFallback` | element / `null`                          | `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#bound-component-types.ts#NextjsBoundOptimizedEntryProps`                                                                                                                                         |
| `OptimizedEntry`                                                                         | component | `/client`             | adds per-entry `liveUpdates`, `loadingFallback` (+ `errorFallback`/`onEntryError` for managed)                                                                         | element / `null`                          | `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry`                                                                                                                                                                                               |
| `NextAppAutoPageTracker`                                                                 | component | `/app-router`         | `initialPageEvent`; `getPagePayload` returns `AutoPagePayload \| undefined`, with custom route data under `properties`; needs `Suspense` (reads `useSearchParams`)     | element                                   | `react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker`; `react-web-sdk#auto-page/types.ts#AutoPagePayloadOptions`; `core-sdk#events/EventBuilder.ts#PageViewBuilderArgs`                                                                                    |
| `useOptimizationActions`                                                                 | hook      | `/client`             | —                                                                                                                                                                      | `{ setConsent, identifyUser, resetUser }` | `react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions`; `react-web-sdk#hooks/useOptimizationActions.ts#UseOptimizationActionsResult`                                                                                                            |
| `useConsentState` / `useProfileState` / `useOptimizationContext` / `useMergeTagResolver` | hook      | `/client`             | —                                                                                                                                                                      | state / `{ sdk }` / resolver              | `react-web-sdk#hooks/useOptimizationState.ts#useConsentState`; `react-web-sdk#hooks/useOptimizationState.ts#useProfileState`; `react-web-sdk#hooks/useOptimization.ts#useOptimizationContext`; `react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver` |

Note: bound `/app-router` `OptimizedEntry` omits per-entry `liveUpdates`/`loadingFallback` so the
same import type-checks in Server + Client Components; use `/client` `OptimizedEntry` for per-entry
control.
source: `nextjs-sdk#bound-component-types.ts#NextjsBoundOptimizedEntryProps`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntryProps`

The bound `OptimizationRoot` and bound `OptimizationProvider` each create a React Web provider from
the supplied `handoff`, `hydration`, and any managed-entry descriptors fetched into
`handoff.entries`. `OptimizationRoot` additionally forwards route/page-event inputs to React Web;
`OptimizationProvider` owns only the content SDK context plus the live-updates wrapper. Descendants
consume the nearest React context. A second config-owned browser provider attempts to create another
SDK singleton; normally keep one bound provider around the participating tree.
source: `nextjs-sdk#app-router-server.tsx#renderBoundRootTree`; `nextjs-sdk#app-router-server.tsx#OptimizationProvider`; `nextjs-sdk#app-router-client.ts#OptimizationRoot`; `nextjs-sdk#app-router-client.ts#OptimizationProvider`; `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`; `react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime`; `react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries`; `react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider`; `react-web-sdk#context/OptimizationContext.tsx#OptimizationContext`; `web-sdk#ContentfulOptimization.ts#ContentfulOptimization`

## Render / entry resolution

- Render prop hands back a base `contentful` `Entry`; cast `resolved as YourType`
  (`as unknown as YourType` only for genuinely disjoint types). Baseline-fallback contract: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). Double-wrapping the same
  baseline id renders `null` + dev warning.
  source: `react-web-sdk#optimized-entry/optimizedEntryUtils.ts#OptimizedEntryRenderContext`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#useDuplicateBaselineGuard`

## Identifier ownership

| Identifier                              | Owner  | Notes                                                                              | source                                                                                                                                                                                                     |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Written by response-persistence helpers; must NOT be `HttpOnly` (browser reads it) | `core-sdk#constants.ts#ANONYMOUS_ID_COOKIE`; `nextjs-sdk#server.tsx#persistNextjsAnonymousId`; `nextjs-sdk#cookies.ts#createNextjsAnonymousIdSetCookieHeader`; `nextjs-sdk#edge.ts#persistEdgeAnonymousId` |
| app consent cookie                      | reader | Reader names/writes/reads; SDK only calls `consent.server`                         | `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentResolver`; `nextjs-sdk#app-router-server.tsx#resolveServerConsent`; `nextjs-sdk#edge.ts#resolveServerConsent`                          |
| `NEXT_PUBLIC_*` env vars                | reader | Next.js exposes only `NEXT_PUBLIC_`-prefixed vars to browser                       | `extern:Next.js exposes only NEXT_PUBLIC_-prefixed vars to the browser`                                                                                                                                    |

## Events & tracking

- App Router request handoff helpers call the request-bound SDK's `page()` method. A browser handoff
  carries explicit `initialPageEvent`; request helpers set it from `pageResult.accepted`, and
  selection helpers require the caller to provide it.
  source: `nextjs-sdk#server.tsx#createNextjsRequestHandoff`; `nextjs-sdk#handoff.ts#createHandoffFromSelections`
- `NextAppAutoPageTracker` must stay inside `Suspense` (reads `useSearchParams`).
  Duplicate-page-event control: `initialPageEvent="skip"` when the server already reported the view,
  `"emit"` for browser-owned routes.
  source: `react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker`; `react-web-sdk#auto-page/useAutoPageEmitter.ts#InitialAutoPageEvent`
- Interaction tracking on by default with `OptimizedEntry`; opt out via binding config
  `trackEntryInteraction`; uses resolved entry id.
  source: `react-web-sdk#provider/OptimizationProvider.tsx#TrackEntryInteractionOptions`; concept:interaction-tracking-in-web-sdks

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Per-request
  `consent.server` reads request `cookies.get(NAME)`; browser defaults are seeded via
  `consent.clientDefaults`.
  source: `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentContext`; `nextjs-sdk#app-router-server.tsx#resolveServerConsent`; `nextjs-sdk#app-router-server.tsx#toClientRootConfig`

## Version / runtime quirks

- **Request helpers require explicit request input:** App Router routes pass request headers,
  cookies, and URL into `createRequestHandoff()`. Reading `headers()` / `cookies()` in an App Router
  route is a dynamic-rendering choice owned by that route.
  source: `nextjs-sdk#app-router-server.tsx#createRequestHandoff`; `extern:calling next/headers headers() opts a route into dynamic rendering, disabling revalidate and generateStaticParams`
- Middleware/proxy helpers are chainable with an existing `NextResponse`: they preserve Next's
  forwarded request headers encoded in `x-middleware-override-headers` and `x-middleware-request-*`,
  clear only SDK-owned `x-ctfl-opt-*` request context, then write the current Optimization request
  URL and optional server data back into the forwarded request header set.
  source: `nextjs-sdk#request-handler.ts#createNextjsOptimizationContextHandler`; `nextjs-sdk#request-handler.ts#sanitizeForwardedRequestHeaders`; `nextjs-sdk#forwarded-request-headers.ts#createForwardedRequestHeaders`; `nextjs-sdk#forwarded-request-headers.ts#applyForwardedRequestHeaders`; `nextjs-sdk#cache-middleware.ts#createNextjsCacheMiddleware`
- **Customer-owned public permutations can be static or edge-rendered:** routes that call
  `createHandoffFromSelections()` with application-provided selections do not need request profile
  state; cache safety is represented by the handoff `cache` scope and key. Request-derived profile
  handoffs must use `private-request` cache scope.
  source: `nextjs-sdk#handoff.ts#createHandoffFromSelections`; `core-sdk#handoff.ts#getOptimizationCacheSafetyWarnings`; `node-sdk#handoff.ts#createRequestHandoffFromData`
- **Rendered server output is request-specific:** the bound `OptimizedEntry` reads the current
  request's forwarded `OptimizationData` and resolves a supplied or managed baseline entry with that
  request's `selectedOptimizations`; merge tags can also read its profile. Forwarded server data,
  resolved entries, and rendered personalized HTML are therefore not safe to share across visitors
  unless a cache key covers the complete personalization context. Raw Contentful baseline-entry
  caching is a separate application policy.
  source: `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#app-router-server.tsx#resolveManagedServerOptimizedEntry`; `core-sdk#CoreBase.ts#resolveOptimizedEntry`
- **The bound root provides a handoff-to-live transition:** React Web builds the initial browser
  render from `handoff.state` and `handoff.entries`, then hydrates the owned live SDK before
  switching the context runtime. Children remain mounted through the transition.
  source: `nextjs-sdk#app-router-server.tsx#toClientRootConfig`; `react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime`; `react-web-sdk#provider/OptimizationProvider.tsx#initializeServerOptimizationState`; `react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider`
  A handoff without matching baseline entries cannot guarantee no visual change for managed-entry
  client rendering; stable takeover also requires the browser to render the same baseline entry
  through the same component path or to receive a matching managed-entry handoff in `handoff.entries`.
  source: `react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime`; `react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries`; `react-web-sdk#optimized-entry/useOptimizedEntry.ts#useManagedBaselineEntry`

## Failure & fallback behavior

- Baseline fallback when event policy produced no selections / no variant / unresolved links /
  all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: `kb:shared/concepts.md`
