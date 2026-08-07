# Next.js App Router (`@contentful/optimization-nextjs`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md, documentation/guides/rendering-personalized-nextjs-routes-with-static-isr-and-edge-handoffs.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only App-Router specifics.
Pages Router surface: see [`nextjs-pages-router.md`](./nextjs-pages-router.md). Facts here are
verified against `packages/web/frameworks/nextjs-sdk/src` and its `react-web-sdk`/`core-sdk`
dependencies; each carries a symbol-anchored source pointer.

## Package & entry points

| Import path                                           | Purpose                                                                                        | source                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-nextjs/app-router/server`   | Server binder for explicit-input roots and helpers plus the SDK-owned request component family | `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterServerOptimization`; `nextjs-sdk#app-router-server.tsx#NextjsAppRouterServerOptimization`; `nextjs-sdk#bound-component-types.ts#NextjsAppRouterRequestOptimization` |
| `@contentful/optimization-nextjs/app-router/client`   | Client binder for bound browser roots, entries, and handoff helpers (`'use client'`)           | `nextjs-sdk#app-router-client.ts#bindNextjsAppRouterClientOptimization`; `nextjs-sdk#app-router-client.ts#NextjsAppRouterClientOptimization`                                                                             |
| `@contentful/optimization-nextjs/client`              | Browser-only hooks + per-entry live-update controls (`'use client'`)                           | `nextjs-sdk#client.ts`                                                                                                                                                                                                   |
| `@contentful/optimization-nextjs/server`              | Manual server SDK control (advanced routes)                                                    | `nextjs-sdk#server.tsx#configureNextjsServerOptimization`                                                                                                                                                                |
| `@contentful/optimization-nextjs/edge`                | Edge runtime request and public permutation handoff helpers                                    | `nextjs-sdk#edge.ts#configureNextjsEdgeOptimization`; `nextjs-sdk#edge.ts#NextjsEdgeOptimization`                                                                                                                        |
| `@contentful/optimization-nextjs/cache-middleware`    | Public permutation proxy/middleware rewrite helper                                             | `nextjs-sdk#cache-middleware.ts#createNextjsPublicPermutationCacheMiddleware`                                                                                                                                            |
| `@contentful/optimization-nextjs/request-handler`     | Next middleware/proxy request-context forwarding helper                                        | `nextjs-sdk#request-handler.ts#createNextjsOptimizationContextHandler`                                                                                                                                                   |
| `@contentful/optimization-nextjs/tracking-attributes` | Sole entrypoint for server/static/edge `data-ctfl-*` tracking attributes                       | `nextjs-sdk#tracking-attributes.ts#getServerTrackingAttributes`; `nextjs-sdk#app-router-server.tsx#NextjsAppRouterServerOptimization`; `nextjs-sdk#app-router-client.ts#NextjsAppRouterClientOptimization`               |
| `@contentful/optimization-nextjs/api-schemas`         | Type guards `isMergeTagEntry`, `isResolvedContentfulEntry`                                     | `nextjs-sdk#api-schemas.ts`; `api-schemas#contentful/typeGuards.ts#isMergeTagEntry`; `api-schemas#contentful/typeGuards.ts#isResolvedContentfulEntry`                                                                    |

## Setup / initialization and binding

- The server and client binders create app-level component/helper sets. The server binder owns both
  the React-cached handoff store used by top-level components and the cached initializer used by its
  nested request family. Browser defaults are supplied through `consent.clientDefaults`;
  server/request consent is supplied through `consent.server`.
  source: `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterServerOptimization`; `nextjs-sdk#app-router-server.tsx#getRequestHandoffStore`; `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#app-router-client.ts#bindNextjsAppRouterClientOptimization`; `nextjs-sdk#bound-component-types.ts#NextjsOptimizationConsentConfig`; `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentResolver`
- `api.experienceBaseUrl` and `api.insightsBaseUrl` override the API clients' built-in production
  endpoints; omit them for the default hosts. `app: { name, version }` is attached to outgoing event
  context as application attribution metadata.
  source: `core-sdk#CoreApiConfig.ts#CoreSharedApiConfig`; `api-client#experience/ExperienceApiClient.ts#EXPERIENCE_BASE_URL`; `api-client#insights/InsightsApiClient.ts#INSIGHTS_BASE_URL`; `core-sdk#events/EventBuilder.ts#EventBuilderConfig`; `core-sdk#events/EventBuilder.ts#buildUniversalEventProperties`
- API clients default an omitted `environment` to `main`; an explicitly configured environment is
  used as supplied. Guides should still show the value when the reader must make project targeting
  unambiguous.
  source: `api-client#ApiClientBase.ts#DEFAULT_ENVIRONMENT`; `api-client#ApiClientBase.ts#ApiClientBase`
- **`contentful?: ContentfulConfig` (managed fetching):** via the core `contentful` config. The bound
  server `OptimizedEntry` accepts a manual `baselineEntry`, a flat managed `entryId` + `entryQuery`
  source, or an ID/slug object descriptor under `managedEntry`; the config powers the two managed
  paths. The server validates exactly one source at runtime, then resolves with request handoff
  selections; slug renders use the fetched baseline and resolved entry IDs for tracking. The binding
  does not forward `contentful` to browser config; managed fetching runs on the server side.
  The bound `OptimizationRoot` / `OptimizationProvider` accept `hydration` plus
  `prefetchManagedEntries` descriptors; descriptors are fetched server-side through
  `sdk.prefetchManagedEntries()` and merged into `handoff.entries`.
  source: `nextjs-sdk#app-router-server.tsx#resolveAppRouterOptimizedEntry`; `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`; `nextjs-sdk#app-router-server.tsx#toClientProviderConfig`; `core-sdk#CoreBase.ts#ContentfulConfig`; `core-sdk#CoreBase.ts#prefetchManagedEntries`; `core-sdk#CoreBase.ts#fetchOptimizedEntry`
- A bound server managed `OptimizedEntry` fetches and resolves that one server render but does not
  add its baseline entry to the browser handoff. A browser managed entry is seeded only when a
  matching `ManagedEntryHandoff` reaches the root through `handoff.entries` or is produced from the
  root's `prefetchManagedEntries` descriptors. Otherwise the browser has no Contentful
  client in its derived config and cannot infer the server component's managed fetch.
  source: `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#app-router-server.tsx#renderBoundRootTree`; `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`; `nextjs-sdk#app-router-server.tsx#toClientProviderConfig`; `react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries`
- Request handoff: the bound `createRequestHandoff(options)` reads forwarded server context from the
  request headers' `x-ctfl-opt-server-data` value only when `trustedRequestHandoff: true` is passed.
  Raw forwarded server-data headers are ignored without that explicit opt-in. Trusted forwarded
  context can carry `consent`, boolean `pageAccepted`, and optional non-empty `profileId`, not full
  `OptimizationData`; when `profileId` is present, the helper fetches profile/selection data with
  `getProfile()` and builds a browser handoff without evaluating `page()` again. The profile fetch
  uses request handoff `locale` before bound config `locale` before `experienceOptions.locale`, and
  forwards `experienceOptions.ip` when supplied. Boolean consent seeds both consent axes; object
  consent seeds `consent` when `events` is present and always sets `persistenceConsent`, defaulting
  missing `persistence` to `false`. The handoff uses `pageAccepted: true` for
  `initialPageEvent: 'skip'` and `pageAccepted: false` for `initialPageEvent: 'emit'`. Without valid
  forwarded context, the helper binds the request, calls `page()`, builds a browser handoff, and sets
  `initialPageEvent` to `'skip'` exactly when `pageResult.accepted` is true; response data presence
  is not the page-event ownership signal.
  source: `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#app-router-request-handoff.ts#NextjsForwardedServerData`; `nextjs-sdk#app-router-request-handoff.ts#readNextjsForwardedServerData`; `nextjs-sdk#app-router-request-handoff.ts#toForwardedProfileOptions`; `nextjs-sdk#app-router-request-handoff.ts#toHandoffDefaults`; `nextjs-sdk#request-context.ts#NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER`; `nextjs-sdk#request-context.ts#parseNextjsOptimizationRequestContext`; `nextjs-sdk#server.tsx#createNextjsRequestHandoff`
- The server binder's nested `request` components all await one no-argument React-cached
  initializer. It reads Next.js headers and cookies, derives the request URL, route key, initial page
  payload, and hydration once, creates one request handoff, and shares those render inputs among the
  four wrappers for that RSC request. A request `OptimizedEntry` waits for initialization before it
  delegates to the top-level entry resolver, so it observes the same stored selections even when it
  starts before the request root. Separate RSC requests receive separate cached resources and
  handoff state.
  source: `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterServerOptimization`
- Request hydration defaults to `preserve-server`. A configured resolver runs once during cached
  initialization with the SDK-derived request URL and route key.
  source: `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#bound-component-types.ts#NextjsAppRouterRequestHydration`
- The request root delegates with the resource-owned handoff, hydration, route key, and initial page
  payload; the request provider delegates with the handoff and hydration; the request entry waits
  before delegating its own props unchanged; and the request tracker delegates with
  `handoff.initialPageEvent`.
  source: `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`
- Selection handoff: the bound `createHandoffFromSelections(input)` adds browser hydration metadata to
  the Core selection handoff. It is the lower-level App Router helper for explicit selection
  handoffs; applications supply the selected optimizations, cache metadata, hydration mode, and
  initial page-event ownership.
  source: `nextjs-sdk#handoff.ts#createHandoffFromSelections`; `core-sdk#handoff.ts#createHandoffFromSelections`
- Public permutation handoff: `createPublicPermutationHandoff(input)` creates public-permutation
  cache metadata from `permutationKey`, optional `cacheVersion`, locale, entry IDs, selected
  optimizations, and optional caller-owned tags, then delegates to the selection handoff path.
  The helper does not evaluate the Experience API or derive selections from public route
  dimensions; the caller supplies the selected-optimization list. Custom Flag `changes` are
  serialized into handoff state, but they are not inputs to public cache metadata or the generated
  cache-key fingerprint. If rendered flag values affect cacheable output, the caller represents that
  dimension through `cacheVersion` or another app-owned key or tag.
  `cacheVersion` can be omitted by API shape; when present, it is encoded as a `version=...` key
  field. The generated `cache.key` is SDK identity and transport metadata, not a Next.js
  `cacheTag()` or `revalidateTag()` tag. Supplied tags are validated as Next.js caller-owned
  invalidation labels: at most 128 tags, each non-empty after trimming, 256 characters or fewer, and
  without commas.
  source: `nextjs-sdk#handoff.ts#createPublicPermutationHandoff`; `nextjs-sdk#handoff.ts#createPublicPermutationCacheMetadata`; `nextjs-sdk#cache-tags.ts#validateNextjsPublicPermutationCacheTags`; `core-sdk#handoff.ts#createPublicPermutationCacheMetadata`; `core-sdk#handoff.ts#createOptimizationCacheKey`
- `resolveEntriesForSelections` is re-exported through the App Router binding so public/static
  selection renders can resolve multiple baseline entries with one selected-optimization set; shared
  behavior is recorded in [`../shared/concepts.md`](../shared/concepts.md#optimization-handoff).
  source: `nextjs-sdk#app-router-server.tsx#resolveEntriesForSelections`; `core-sdk#handoff.ts#resolveEntriesForSelections`
- `createOptimizationCacheKey` is re-exported through the App Router binding as a lower-level helper
  for explicit selection handoffs that need app-owned cache keys from scope, locale, baseline entry
  IDs, and selected optimizations.
  source: `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterServerOptimization`; `nextjs-sdk#app-router-client.ts#bindNextjsAppRouterClientOptimization`; `core-sdk#handoff.ts#createOptimizationCacheKey`
- `createNextjsPublicPermutationCacheMiddleware(options)` rewrites only when `resolveCache(request)`
  returns public-permutation cache metadata and an existing response is not terminal. Existing
  rewrite, redirect, or plain non-pass-through responses are returned unchanged; pass-through Next
  middleware/proxy responses keep flowing through the rewrite path. Invalid metadata throws. The
  default rewrite stores `cache.key` in the
  `ctfl-opt-cache-key` search parameter; custom rewrites receive both `cache.key` and
  `encodedCacheKey`. If metadata includes tags, the middleware applies the same Next.js tag
  validation as the handoff helper. Rewrites preserve forwarded request headers and merge
  rewrite/forwarding headers back into an existing response when one is supplied.
  source: `nextjs-sdk#cache-middleware.ts#createNextjsPublicPermutationCacheMiddleware`; `nextjs-sdk#cache-middleware.ts#assertPublicPermutationCacheMetadata`; `nextjs-sdk#cache-tags.ts#validateNextjsPublicPermutationCacheTags`; `nextjs-sdk#cache-middleware.ts#resolveRewrite`; `nextjs-sdk#cache-middleware.ts#hasExistingTerminalMiddlewareTarget`; `nextjs-sdk#forwarded-request-headers.ts#createForwardedRequestHeaders`; `nextjs-sdk#forwarded-request-headers.ts#applyForwardedRequestHeaders`
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

| Name                                                                                     | Kind             | Import path                                  | source                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top-level bound roots, `OptimizedEntry`, and `NextAppAutoPageTracker`                    | component family | `/app-router/server`                         | `nextjs-sdk#app-router-server.tsx#NextjsAppRouterServerOptimization`                                                                                                                                                                                            |
| Request-bound roots, `OptimizedEntry`, and `NextAppAutoPageTracker`                      | component family | `/app-router/server`                         | `nextjs-sdk#bound-component-types.ts#NextjsAppRouterRequestOptimization`; `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`                                                                                                         |
| Bound browser roots, `OptimizedEntry`, and `NextAppAutoPageTracker`                      | component family | `/app-router/client`                         | `nextjs-sdk#app-router-client.ts#NextjsAppRouterClientOptimization`                                                                                                                                                                                             |
| `OptimizedEntry`                                                                         | component        | `/client`                                    | `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry`                                                                                                                                                                                               |
| `NextAppAutoPageTracker`                                                                 | component        | `/app-router/server` or `/app-router/client` | `react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker`                                                                                                                                                                                                      |
| `useOptimizationActions`                                                                 | hook             | `/client`                                    | `react-web-sdk#hooks/useOptimizationActions.ts#useOptimizationActions`                                                                                                                                                                                          |
| `useConsentState` / `useProfileState` / `useOptimizationContext` / `useMergeTagResolver` | hook family      | `/client`                                    | `react-web-sdk#hooks/useOptimizationState.ts#useConsentState`; `react-web-sdk#hooks/useOptimizationState.ts#useProfileState`; `react-web-sdk#hooks/useOptimization.ts#useOptimizationContext`; `react-web-sdk#hooks/useMergeTagResolver.ts#useMergeTagResolver` |

Note: bound App Router `OptimizedEntry` omits per-entry `liveUpdates`/`loadingFallback`; use
`/client` `OptimizedEntry` for per-entry control.
source: `nextjs-sdk#bound-component-types.ts#NextjsBoundOptimizedEntryProps`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntryProps`

The bound `OptimizationRoot` and bound `OptimizationProvider` each create a React Web provider from
the supplied `handoff`, `hydration`, and any managed-entry descriptors fetched into
`handoff.entries`. `OptimizationRoot` additionally forwards route/page-event inputs to React Web;
`OptimizationProvider` owns only the content SDK context plus the live-updates wrapper. Descendants
consume the nearest React context. A second config-owned browser provider attempts to create another
SDK singleton; normally keep one bound provider around the participating tree.
source: `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterServerOptimization`; `nextjs-sdk#app-router-client.ts#bindNextjsAppRouterClientOptimization`; `nextjs-sdk#app-router-server.tsx#renderBoundRootTree`; `nextjs-sdk#app-router-server.tsx#OptimizationProvider`; `nextjs-sdk#app-router-client.ts#OptimizationRoot`; `nextjs-sdk#app-router-client.ts#OptimizationProvider`; `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`; `react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime`; `react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries`; `react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider`; `react-web-sdk#context/OptimizationContext.tsx#OptimizationContext`; `web-sdk#ContentfulOptimization.ts#ContentfulOptimization`

## Render / entry resolution

- Bound and server `OptimizedEntry` surfaces carry one caller-supplied skeleton set through render
  props, metadata, and callbacks; baseline and resolved metadata entries use that same set without
  changing runtime variant choice. Shared modeling and narrowing behavior: see
  [`../shared/concepts.md`](../shared/concepts.md#entry-resolution). Double-wrapping the same baseline
  id renders `null` plus a development warning.
  source: `nextjs-sdk#bound-component-types.ts#NextjsBoundOptimizedEntryComponent`; `nextjs-sdk#server.tsx#ServerOptimizedEntry`; `core-sdk#OptimizedEntryMetadata.ts#OptimizedEntryMetadata`; `react-web-sdk#optimized-entry/OptimizedEntry.tsx#useDuplicateBaselineGuard`
- Bound App Router `OptimizedEntry` and standalone `ServerOptimizedEntry` retain their server-rendered
  host and tracking attributes for an empty result while omitting consumer content. The bound render
  prop is not invoked; an absent empty-variant flag renders normally.
  source: `nextjs-sdk#server-entry-renderer.tsx#renderOptimizedEntryOnServer`; `nextjs-sdk#server-entry-renderer.tsx#resolveOptimizedEntryChildren`; `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#server.tsx#ServerOptimizedEntry`
- `prefetchManagedEntries` without a supplied `handoff` creates a synthetic `static` +
  `preserve-server` handoff with `selectedOptimizations: []` and `initialPageEvent: 'emit'`.
  source: `nextjs-sdk#app-router-server.tsx#resolveHandoffEntries`
- Runtime props that provide zero or multiple `baselineEntry`, `entryId`, and `managedEntry` sources
  reject before any managed fetch; the error names those three allowed sources.
  source: `nextjs-sdk#app-router-server.tsx#resolveAppRouterOptimizedEntry`

## Identifier ownership

| Identifier                              | Owner  | Notes                                                                              | source                                                                                                                                                                                                     |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Written by response-persistence helpers; must NOT be `HttpOnly` (browser reads it) | `core-sdk#constants.ts#ANONYMOUS_ID_COOKIE`; `nextjs-sdk#server.tsx#persistNextjsAnonymousId`; `nextjs-sdk#cookies.ts#createNextjsAnonymousIdSetCookieHeader`; `nextjs-sdk#edge.ts#persistEdgeAnonymousId` |
| app consent cookie                      | reader | Reader names/writes/reads; SDK only calls `consent.server`                         | `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentResolver`; `nextjs-sdk#app-router-request-runtime.tsx#resolveServerConsent`; `nextjs-sdk#edge.ts#resolveServerConsent`                 |
| `NEXT_PUBLIC_*` env vars                | reader | Next.js exposes only `NEXT_PUBLIC_`-prefixed vars to browser                       | `extern:Next.js exposes only NEXT_PUBLIC_-prefixed vars to the browser`                                                                                                                                    |

## Events & tracking

- App Router request handoff helpers call the request-bound SDK's `page()` method. A browser handoff
  carries explicit `initialPageEvent`; direct request helpers set it from `pageResult.accepted`,
  forwarded request handoffs set it from boolean `pageAccepted`, and selection helpers require the
  caller to provide it. The nested request tracker receives this value from its shared handoff, so
  page-event ownership does not depend on which request wrapper starts first.
  source: `nextjs-sdk#server.tsx#createNextjsRequestHandoff`; `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#app-router-request-handoff.ts#readNextjsForwardedServerData`; `nextjs-sdk#handoff.ts#createHandoffFromSelections`
- `NextAppAutoPageTracker` must stay inside `Suspense` (reads `useSearchParams`).
  Duplicate-page-event control: `initialPageEvent="skip"` when the server already reported the view,
  `"emit"` for browser-owned routes.
  source: `react-web-sdk#router/next-app.tsx#NextAppAutoPageTracker`; `react-web-sdk#auto-page/useAutoPageEmitter.ts#InitialAutoPageEvent`
- Interaction tracking on by default with `OptimizedEntry`; opt out via binding config
  `trackEntryInteraction`; uses resolved entry id.
  source: `react-web-sdk#provider/OptimizationProvider.tsx#TrackEntryInteractionOptions`; concept:interaction-tracking-in-web-sdks
- Bound browser roots forward `onStatesReady` to React Web client providers. Browser event
  forwarding uses the shared React Web/Core behavior: subscribers registered with `onStatesReady`
  attach before child auto-page effects emit through the live runtime, event streams are not durable
  histories, blocked events are diagnostic only, and event-stream `optimization` is not sent to
  Experience/Insights API payloads.
  source: `nextjs-sdk#app-router-server.tsx#toClientRootConfig`; `nextjs-sdk#app-router-client.ts#toClientRootConfig`; `react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider`; kb:shared/concepts.md; kb:web/react-web.md
- Browser/client flags use the React Web stateful runtime: `sdk.getFlag()` and `sdk.states.flag()`
  auto-attempt flag-view tracking, while `sdk.trackFlagView()` is the explicit/manual path.
  source: `react-web-sdk#hooks/useOptimization.ts#useOptimizationContext`; core-sdk#CoreStatefulEventEmitter.ts#getFlag; core-sdk#CoreStatefulEventEmitter.ts#getFlagObservable; core-sdk#CoreStatefulEventEmitter.ts#trackFlagView
- Preview-panel attachment is a browser/client concern; once attached to the live client SDK, its
  audience, variant, and inline-variable overrides use the shared preview override behavior and
  force live updates while open.
  source: preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanelToSdk; core-sdk#preview-support/PreviewOverrideManager.ts#setVariantOverride; core-sdk#preview-support/applyChangeOverrides.ts#applyChangeOverrides; react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Per-request
  `consent.server` reads request `cookies.get(NAME)`; browser defaults are seeded via
  `consent.clientDefaults`.
  source: `nextjs-sdk#bound-component-types.ts#NextjsOptimizationServerConsentContext`; `nextjs-sdk#app-router-request-runtime.tsx#resolveServerConsent`; `nextjs-sdk#app-router-server.tsx#toClientRootConfig`; `nextjs-sdk#app-router-client.ts#toClientRootConfig`
- Omitted `consent.server` resolves request consent to `false` for App Router and Edge request
  handoff helpers.
  source: `nextjs-sdk#app-router-request-runtime.tsx#resolveServerConsent`; `nextjs-sdk#edge.ts#resolveServerConsent`

## Version / runtime quirks

- **Request-family components read the active Next.js request:** their shared initializer calls
  `headers()` and `cookies()`, so this family is a dynamic request-rendering path. The top-level
  server component and handoff surfaces keep explicit inputs and do not call those Next.js request
  APIs; static, public-permutation, analytics-only, and manual paths can stay independent of the
  request family.
  source: `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#app-router-server.tsx#bindNextjsAppRouterServerOptimization`; `extern:calling next/headers headers() opts a route into dynamic rendering, disabling revalidate and generateStaticParams`
- Next.js handler naming is framework-owned: use `proxy.ts` with `proxy` in Next.js 16 and
  `middleware.ts` with `middleware` in Next.js 13 to 15. The SDK helpers use the same handler body
  in either export. If the file/export pair does not match the framework version, Next.js does not
  invoke it, so SDK request-context forwarding and public cache rewrites do not run.
  source: `nextjs-sdk#request-handler.ts#createNextjsOptimizationContextHandler`; `nextjs-sdk#cache-middleware.ts#createNextjsPublicPermutationCacheMiddleware`; `extern:Next.js proxy and middleware file conventions`
- Middleware/proxy helpers are chainable with an existing `NextResponse`, but existing rewrites
  differ by helper. Public permutation cache middleware treats an existing rewrite, redirect, or
  plain non-pass-through response as terminal and returns it unchanged. The request-context handler
  treats redirects and plain non-pass-through responses as terminal; existing rewrite responses keep
  their rewrite target while the handler still applies sanitized SDK request context and eligible
  anonymous-id cookie persistence. For pass-through responses, helpers preserve Next's forwarded
  request headers encoded in
  `x-middleware-override-headers` and `x-middleware-request-*`, clear only SDK-owned `x-ctfl-opt-*`
  request context, then write the current Optimization request URL back into the forwarded request
  header set. This removes direct client-supplied `x-ctfl-opt-server-data` before a trusted handler
  writes its own forwarded context. When configured with `sdk` and `consent`, the request-context
  handler also resolves consent, calls `page()`, serializes compact
  `{ consent, pageAccepted, profileId }` context with
  `encodeURIComponent(JSON.stringify(value))` into the forwarded `x-ctfl-opt-server-data` request
  header without serializing profile traits, changes, or selected optimizations, and persists the
  SDK-owned anonymous ID cookie on the response when persistence permits it. `pageAccepted` is copied
  from `pageResult.accepted`; `profileId` comes from response data or the request-bound profile.
  Without options, it only forwards sanitized request context.
  source: `nextjs-sdk#request-handler.ts#createNextjsOptimizationContextHandler`; `nextjs-sdk#request-handler.ts#hasExistingTerminalMiddlewareTarget`; `nextjs-sdk#request-handler.ts#sanitizeForwardedRequestHeaders`; `nextjs-sdk#request-handler.ts#getRequestOptimizationData`; `nextjs-sdk#request-context.ts#serializeNextjsOptimizationRequestContext`; `nextjs-sdk#server.tsx#getNextjsServerOptimizationData`; `nextjs-sdk#server.tsx#persistNextjsAnonymousId`; `nextjs-sdk#forwarded-request-headers.ts#createForwardedRequestHeaders`; `nextjs-sdk#forwarded-request-headers.ts#applyForwardedRequestHeaders`; `nextjs-sdk#cache-middleware.ts#createNextjsPublicPermutationCacheMiddleware`; `nextjs-sdk#cache-middleware.ts#hasExistingTerminalMiddlewareTarget`
- **Public permutations can be static, ISR, or edge-rendered:** routes that call
  `createPublicPermutationHandoff()` with application-provided selections do not need request
  profile state; cache safety is represented by the helper-created `public-permutation` cache
  metadata. Request handoff helpers accept `private-request` cache metadata and reject public or
  static cache metadata before request evaluation.
  The manual App Router request helper defaults omitted cache metadata to `private-request`; the
  nested request family uses that same default.
  source: `nextjs-sdk#handoff.ts#createPublicPermutationHandoff`; `core-sdk#handoff.ts#createPublicPermutationCacheMetadata`; `nextjs-sdk#app-router-request-handoff.ts#assertRequestHandoffCacheMetadata`; `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#edge.ts#assertEdgeRequestHandoffCacheMetadata`; `node-sdk#handoff.ts#createRequestHandoffFromData`
- **Rendered server output is request-specific:** the bound `OptimizedEntry` reads the current
  request handoff state and resolves a supplied or managed baseline entry with that request's
  `selectedOptimizations`; merge tags can also read its profile. Request handoff state, resolved
  entries, and rendered personalized HTML are therefore not safe to share across visitors unless a
  cache key covers the complete personalization context. Raw Contentful baseline-entry caching is a
  separate application policy.
  source: `nextjs-sdk#app-router-server.tsx#OptimizedEntry`; `nextjs-sdk#app-router-server.tsx#resolveAppRouterOptimizedEntry`; `core-sdk#CoreBase.ts#resolveOptimizedEntry`
- **The bound root provides a handoff-to-live transition:** React Web builds the initial browser
  render from `handoff.state` and `handoff.entries`, then hydrates the owned live SDK before
  switching the context runtime. Children remain mounted through the transition.
  source: `nextjs-sdk#app-router-server.tsx#toClientRootConfig`; `react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime`; `react-web-sdk#provider/OptimizationProvider.tsx#initializeServerOptimizationState`; `react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider`
  A handoff without matching baseline entries cannot guarantee no visual change for managed-entry
  client rendering; stable takeover also requires the browser to render the same baseline entry
  through the same component path or to receive a matching managed-entry handoff in `handoff.entries`.
  source: `react-web-sdk#provider/OptimizationProvider.tsx#createInitialRuntime`; `react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries`; `react-web-sdk#optimized-entry/useOptimizedEntry.ts#useManagedBaselineEntry`

## Failure & fallback behavior

- The request-family initializer requires the SDK-forwarded `x-ctfl-opt-request-url` header and
  throws setup guidance for the Optimization request handler/proxy before it resolves any request
  component when that header is absent.
  source: `nextjs-sdk#app-router-request-runtime.tsx#bindNextjsAppRouterRequestRuntime`; `nextjs-sdk#request-context.ts#NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER`
- Baseline fallback when event policy produced no selections / no variant / unresolved links /
  all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: `kb:shared/concepts.md`
