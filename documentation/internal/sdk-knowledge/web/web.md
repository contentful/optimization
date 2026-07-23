# Web (`@contentful/optimization-web`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-web-sdk-in-a-web-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only Web-SDK specifics.
Imperative `ContentfulOptimization` class + optional Web Components (NOT React; the React Web SDK
wraps this). Package source root: `packages/web/web-sdk/src`; shared core:
`packages/universal/core-sdk/src`; preview panel: `packages/web/preview-panel/src`.

## Package & entry points

| Import path                                        | Purpose                                                         | source                                                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-web` (default export)    | `ContentfulOptimization` class                                  | web-sdk#index.ts; web-sdk#ContentfulOptimization.ts#ContentfulOptimization                                                       |
| `@contentful/optimization-web/web-components`      | `defineContentfulOptimizationElements()` + element/detail types | web-sdk#web-components/index.ts#defineContentfulOptimizationElements                                                             |
| `@contentful/optimization-web/api-schemas`         | Type guards incl. `isMergeTagEntry`                             | web-sdk#api-schemas.ts; api-schemas#contentful/typeGuards.ts#isMergeTagEntry                                                     |
| `@contentful/optimization-web/constants`           | `ANONYMOUS_ID_COOKIE`, `DEFAULT_WEB_ALLOWED_EVENT_TYPES`, etc.  | web-sdk#constants.ts#DEFAULT_WEB_ALLOWED_EVENT_TYPES; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE                                  |
| `@contentful/optimization-web/logger`              | logger utilities                                                | web-sdk#logger.ts                                                                                                                |
| `@contentful/optimization-web/handoff`             | Browser handoff types and content hydration helper              | web-sdk#handoff.ts#BrowserOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoff                                     |
| `@contentful/optimization-web/analytics`           | Analytics-only runtime and analytics handoff hydration helper   | web-sdk#analytics.ts#initializeOptimizationAnalyticsRuntime; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff            |
| `@contentful/optimization-web/tracking-attributes` | Presentation tracking-attribute resolver                        | web-sdk#tracking-attributes.ts; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes |

## Setup / initialization and binding

- `new ContentfulOptimization(config)` — stateful; create ONE per browser runtime and reuse. In a
  browser it attaches to `window.contentfulOptimization` and **throws
  `ContentfulOptimization is already initialized`** if one already exists. `destroy()` for teardown
  only.
  source: web-sdk#ContentfulOptimization.ts#ContentfulOptimization; web-sdk#ContentfulOptimization.ts#destroy
- Config keys (verified):
  - `clientId`, `environment`.
    source: api-client#ApiClientBase.ts#clientId; api-client#ApiClientBase.ts#environment
  - `locale`, `logLevel` (`'warn'`/`'debug'`).
    source: core-sdk#CoreBase.ts#locale; core-sdk#CoreBase.ts#logLevel; api-client#lib/logger/logging.ts#LogLevels
  - `api.experienceBaseUrl` / `api.insightsBaseUrl`.
    source: core-sdk#CoreApiConfig.ts#experienceBaseUrl; core-sdk#CoreApiConfig.ts#insightsBaseUrl
  - `defaults.consent`, `defaults.persistenceConsent` — **`persistenceConsent` defaults to
    `consent`** (`persistenceConsent ?? consent`).
    source: core-sdk#StatefulDefaults.ts#resolveStatefulDefaults
  - `allowedEventTypes`, `queuePolicy`, `onEventBlocked`.
    source: core-sdk#CoreStateful.ts#allowedEventTypes; core-sdk#CoreStateful.ts#queuePolicy; core-sdk#CoreStateful.ts#onEventBlocked
  - `app.name` / `app.version`.
    source: api-schemas#experience/event/properties/App.ts#App
  - `cookie.domain`, `cookie.expires` (days; **default 365**).
    source: web-sdk#lib/cookies.ts#CookieAttributes; web-sdk#ContentfulOptimization.ts#EXPIRATION_DAYS_DEFAULT
  - `autoTrackEntryInteraction` — default `views`/`clicks`/`hovers` all `true`.
    source: web-sdk#entry-tracking/resolveAutoTrackEntryInteractionOptions.ts#resolveAutoTrackEntryInteractionOptions
  - **`contentful?: ContentfulConfig` (managed entry fetching):** opt-in; from `CoreConfig`
    (`OptimizationWebConfig extends CoreStatefulConfig extends CoreConfig`).
    `{ client: ContentfulEntryClient, defaultQuery?: ContentfulEntryQuery, cache?: false |`
    `{ maxEntries?, ttlMs? } }`. `ContentfulEntryClient` = `{ getEntry(entryId, query?), getEntries(query?) }`;
    `ContentfulEntryQuery = EntryQueries<undefined>`. Managed query merges `defaultQuery` + per-call
    query + SDK locale fallback + `include: 10`. One uncached normalized entry uses `getEntry()`;
    multiple uncached entries with the same normalized query use `getEntries()`; same-tick uncached
    single-entry calls with the same normalized query can share `getEntries()`; large `getEntries()`
    fetches split into 100-ID chunks. Cache default `{ maxEntries: 100, ttlMs: 300_000 }`;
    `cache: false` disables.
    source: core-sdk#CoreBase.ts#CoreConfig; core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#ContentfulEntryQuery; core-sdk#CoreBase.ts#ContentfulEntryCacheOptions; core-sdk#CoreBase.ts#fetchContentfulEntries; core-sdk#managed-entry-fetcher.ts#ManagedEntryFetcher; web-sdk#ContentfulOptimization.ts#OptimizationWebConfig; core-sdk#CoreStateful.ts#CoreStatefulConfig
- Browser handoff model: see [`../shared/concepts.md`](../shared/concepts.md#optimization-handoff).
  `hydrateOptimizationHandoff(sdk, handoff)` accepts only content handoffs, validates
  `initialPageEvent`, hydrates state into the live SDK, and leaves page-event emission to the root
  or route tracker that consumes `initialPageEvent`.
  source: web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#handoff-state.ts#hydrateOptimizationSelectionState

## Components & hooks

None (imperative class + Web Components; no React surface). Web Components element table:

| Element / symbol                         | Kind      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | source                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineContentfulOptimizationElements()` | registrar | Side-effect-free until called; registers the two custom elements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | web-sdk#web-components/index.ts#defineContentfulOptimizationElements                                                                                                                                                                                                   |
| `<ctfl-optimization-root>`               | element   | Attributes: `client-id`, `environment`, `hydration`, `locale`, `live-updates`. Properties: `defaults`, `api`, `contentful` (property-only; configures owned-root managed fetching), `trackEntryInteraction`, `sdk`, `onStatesReady`, `prefetchManagedEntries` (warms the SDK-managed entry cache once the root SDK is ready). Reuses `window.contentfulOptimization` automatically if present (`this.assignedSdk ?? getGlobalSdk()`); `sdk` prop supplies an explicit instance. Root-owned SDK defaults view/click/hover on. Events `ctfl-root-ready` / `ctfl-root-error`. | web-sdk#web-components/ContentfulOptimizationRootElement.ts#ContentfulOptimizationRootElement; web-sdk#web-components/ContentfulOptimizationRootElement.ts#prefetchManagedEntries; web-sdk#presentation/optimizationRootRuntime.ts#resolveTrackEntryInteractionOptions |
| `<ctfl-optimized-entry>`                 | element   | Property `baselineEntry` (manual: assigning it triggers resolution) OR `entry-id` attribute / `entryId` property (managed: SDK fetches by ID via configured `contentful.client`); `entryQuery` property; `sdk`. Observed attributes: `entry-id`, `live-updates`, `track-clicks`, `track-hovers`, `track-views`. Events `ctfl-entry-loading` / `ctfl-entry-resolved` / `ctfl-entry-error`.                                                                                                                                                                                  | web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryElement; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#baselineEntry; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#entryQuery                               |
| `ContentfulOptimizedEntryEventDetail`    | type      | `{ entry, metadata, resolvedData, selectedOptimization, selectedOptimizations, snapshot }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryEventDetail                                                                                                                                                                          |

## Render / entry resolution

- **Managed fetch methods (from `CoreBase`; require `contentful: { client }`):**
  - `fetchContentfulEntry(entryId, query?)` → `Promise<Entry>` — calls the configured client's
    `getEntry()` with the merged query (`defaultQuery` + per-call + locale fallback +
    `include: 10`), per-instance cached. Throws if `contentful.client` is not configured.
  - `fetchContentfulEntries(entries)` → `Promise<Entry[]>` — accepts string IDs or
    `{ entryId, entryQuery? }` descriptors; returns entries in descriptor order, including
    duplicates; batches same-query uncached entries through `getEntries()`.
  - `prefetchManagedEntries(entries)` → `Promise<ManagedEntryHandoff[]>` — fetches the same
    descriptors and returns `{ entryId, entryQuery?, baselineEntry }` handoff entries for framework
    cache warming.
  - `fetchOptimizedEntry(entryId, options?)` → `Promise<{ baselineEntry, entry,`
    `selectedOptimization?, ... }>` — fetches then resolves; `options = { query?,`
    `selectedOptimizations? }`. Additive to synchronous `resolveOptimizedEntry()`.
  - `clearContentfulEntryCache()` → clears this instance's managed-entry cache.
    source: core-sdk#CoreBase.ts#clearContentfulEntryCache; core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchContentfulEntries; core-sdk#CoreBase.ts#prefetchManagedEntries; core-sdk#CoreBase.ts#ManagedEntryHandoff; core-sdk#CoreBase.ts#fetchOptimizedEntry; core-sdk#CoreBase.ts#FetchOptimizedEntryResult
- `resolveOptimizedEntry(baselineEntry, selectedOptimizations?)` →
  `{ entry, selectedOptimization?, optimizationContextId? }` (public `ResolvedData` shape). Omitting
  arg 2 defaults to `selectedOptimizationsSignal.value` (current SDK state).
  source: core-sdk#CoreBase.ts#resolveOptimizedEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#ResolvedData; core-sdk#CoreStateful.ts#resolveOptimizedEntry
- `entry` is a base `contentful` `Entry` ⇒ cast `entry as YourType` (`as unknown as YourType` only
  for genuinely disjoint). Baseline fallback: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- **Control-variant precision (subtle):** `selectedOptimization` is `undefined` ONLY when no
  experience matched — no selections, entry not optimized, no optimization entry, or no matching
  selection. When an experience matches but assigns the visitor to the CONTROL/baseline variant
  (`variantIndex === 0` → `resolveTo(entry)`), the returned `entry` equals the baseline YET
  `selectedOptimization` IS defined with `variantIndex: 0`. ⇒ Do not read
  `selectedOptimization === undefined` as "seeing baseline content."
  source: core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext; core-sdk#resolvers/OptimizedEntryResolver.ts#resolveTo
- `SelectedOptimization` fields: `experienceId`, `variantIndex`, `variants`, `sticky`.
  source: api-schemas#experience/optimization/SelectedOptimization.ts#SelectedOptimization
- Loading presentation honors content hydration mode. The default
  `client-only-hidden-until-ready` path can show a loading fallback and hide a baseline layout target
  while content is loading; `preserve-server` suppresses loading fallback, baseline-while-loading,
  and hidden layout target behavior so server-rendered content remains visible.
  source: web-sdk#presentation/OptimizedEntryLoadingPresentation.ts#resolveLoadingPresentation; web-sdk#presentation/OptimizedEntryController.ts#OptimizedEntryControllerOptions; web-sdk#web-components/ContentfulOptimizationRootElement.ts#ContentfulOptimizationRootElement; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryElement

## Identifier ownership

| Identifier                              | Owner  | Notes                                                                                                                                                                           | source                                                                                                                                                         |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Browser-readable; NOT `HttpOnly` (browser SDK reads it for hybrid takeover)                                                                                                     | core-sdk#constants.ts#ANONYMOUS_ID_COOKIE                                                                                                                      |
| `ANONYMOUS_ID_COOKIE` constant          | SDK    | Exported from `/constants`; value === `'ctfl-opt-aid'`                                                                                                                          | web-sdk#constants.ts; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE                                                                                                |
| `data-ctfl-*` tracking attributes       | SDK    | `-entry-id`, `-baseline-id`, `-optimization-id`, `-optimization-context-id`, `-variant-index`, `-sticky`, `-clickable`; entry-id must be the RESOLVED id                        | web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes; web-sdk#entry-tracking/resolveTrackingPayload.ts#CtflDataset |
| app consent cookie/record               | reader | Reader names/writes/reads; SDK only reflects `consent()`                                                                                                                        | concept:consent-management-in-the-optimization-sdk-suite; core-sdk#CoreStateful.ts#consent                                                                     |
| `<ctfl-optimized-entry entry-id>`       | SDK    | Managed-fetch INPUT: entry ID the SDK fetches via the configured `contentful.client`; NOT app lookup metadata. Manual alternative: assign the `baselineEntry` property instead. | web-sdk#web-components/ContentfulOptimizedEntryElement.ts#entryId; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#baselineEntry                     |
| browser env/config values               | reader | Bundler-agnostic; match the app's own browser-visible-var convention                                                                                                            | extern:app owns browser-visible config values (bundler-agnostic)                                                                                               |

## Events & tracking

- Event methods return `EventEmissionResult` `{ accepted, data? }`: `page(payload?)`,
  `identify({ userId, traits? })` (`userId` required), `track({ event, properties? })` (`event`
  required), `screen()`.
  source: core-sdk#CoreStatefulEventEmitter.ts#page; core-sdk#CoreStatefulEventEmitter.ts#identify; core-sdk#CoreStatefulEventEmitter.ts#track; core-sdk#CoreStatefulEventEmitter.ts#screen; core-sdk#events/EventEmissionResult.ts#EventEmissionResult; core-sdk#events/EventBuilder.ts#IdentifyBuilderArgs; core-sdk#events/EventBuilder.ts#TrackBuilderArgs
- `page()` (accepted) populates `states.selectedOptimizations`.
  source: core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals
- `trackCurrentPage({ routeKey, buildPayload, initialPageEvent? })` — dedupes consecutive identical
  route keys; `initialPageEvent: 'skip'` for hybrid first-route dedupe; a bare `page()` always emits
  when consent permits.
  source: web-sdk#ContentfulOptimization.ts#trackCurrentPage; core-sdk#tracking/AcceptedCurrentStateTracker.ts#emitIfNeeded
- Interaction tracking: SDK observes any DOM element carrying `data-ctfl-*`; auto view/click/hover
  on by default; opt out per-type via `autoTrackEntryInteraction`. Manual:
  `tracking.enableElement('views', el, { data, dwellTimeMs })` / `disableElement` / `clearElement`
  (manual data precedes attributes). Uses RESOLVED entry id.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#EntryInteractionRuntime; web-sdk#entry-tracking/resolveAutoTrackEntryInteractionOptions.ts#EntryInteractionApi; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes
- Flags: `getFlag(name)` one-off; `states.flag(name)` reactive; flag-view emission gated on
  consent+profile and deduped.
  source: core-sdk#CoreStatefulEventEmitter.ts#getFlag
- Analytics forwarding: `states.eventStream.current?.messageId` + `.subscribe`; dedupe by
  `messageId`; every event carries `messageId` + `type`.
  source: api-schemas#experience/event/UniversalEventProperties.ts#UniversalEventProperties; api-schemas#experience/event/PageViewEvent.ts#PageViewEvent
- Analytics-only handoff: `initializeOptimizationAnalyticsRuntime(config)` creates a narrow Web
  runtime with `tracking`, `trackCurrentPage`, `flush`, and `destroy`, but no content-resolution
  surface. It removes the global browser SDK reference if construction registered this analytics
  runtime's own internal SDK instance. Hydration through `hydrateOptimizationAnalyticsHandoff`
  accepts only `hydration: 'analytics-only'`, hydrates handoff state, warns when a skipped initial
  page lacks profile continuity, then delegates initial route ownership to `trackCurrentPage()`.
  source: web-sdk#analytics.ts#initializeOptimizationAnalyticsRuntime; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff; web-sdk#analytics.ts#warnSkippedInitialPageWithoutProfileContinuity

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Two axes.
  `consent(boolean)` sets both; `consent({ events, persistence })` sets independently.
  source: core-sdk#CoreStateful.ts#consent; core-sdk#consent/Consent.ts#ConsentInput
- Default pre-consent allow-list = `['identify','page']`; other events blocked until consent.
  Overridden by `allowedEventTypes`.
  source: web-sdk#constants.ts#DEFAULT_WEB_ALLOWED_EVENT_TYPES; core-sdk#consent/ConsentPolicy.ts#UNLOCKING_EVENT_TYPES; core-sdk#consent/ConsentPolicy.ts#hasEventConsent
- `states.*` observables: `consent`, `persistenceConsent`, `profile`, `selectedOptimizations`,
  `eventStream`, `blockedEventStream`, `flag(name)`. Immediate-emit-on-subscribe; `.current` sync
  read; `.subscribe(...).unsubscribe()`.
  source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#signals/Observable.ts#Observable; core-sdk#signals/Observable.ts#Subscription
- `reset()` clears profile state, selected optimizations, route dedupe, `ctfl-opt-aid` cookie +
  LocalStore continuity (also stops entry-interaction tracking, clears changes/eventStream/
  blockedEventStream/experienceRequestState — non-exhaustive but nothing extra harms the reader).
  Does NOT touch consent/persistence signals or app/CMP records.
  source: web-sdk#ContentfulOptimization.ts#reset; core-sdk#CoreStateful.ts#reset; web-sdk#storage/LocalStore.ts#LocalStore
- `setLocale(nextLocale)` updates subsequent Experience/event locale only; does not refetch or clear
  caches.
  source: core-sdk#CoreStateful.ts#setLocale

## Version / runtime quirks

- **Imperative + synchronously ready:** unlike the React SDK there is no "not ready on first render"
  window — `resolveOptimizedEntry()`, `getFlag()`, `states.*` work the moment the instance is
  constructed. BUT optimization state is empty until an accepted `page()`/`identify()` returns
  selections ⇒ resolve-before-emit yields baseline. Ordering: construct → emit → resolve.
  source: core-sdk#CoreStateful.ts#resolveOptimizedEntry; core-sdk#CoreStatefulEventEmitter.ts#page
- SDK config is bundler-agnostic (no framework env-var convention). Store the instance in a
  module-level singleton.
- Web Components entrypoint is side-effect-free until `defineContentfulOptimizationElements()` runs.
  source: web-sdk#web-components/index.ts#defineContentfulOptimizationElements

## Failure & fallback behavior

- Baseline fallback when event policy produced no selections / no variant / unresolved links /
  all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). Concrete fallback returns in
  the resolver.
  source: core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext
- `consent(false)` blocks non-allowed events and clears SDK durable storage; does NOT drop the
  active in-memory profile (use `reset()`) or erase app/server/CMP records.
  source: core-sdk#CoreStateful.ts#consent
- Preview panel: separate published package `@contentful/optimization-web-preview-panel` (dir
  `packages/web/preview-panel`), `attachOptimizationPreviewPanel` is its DEFAULT export.
  `attachOptimizationPreviewPanel({ contentful? | entries? | optimization?, nonce? })`;
  `entries: { audiences, experiences }`; defaults to `window.contentfulOptimization` when
  `optimization` omitted. Requires either `contentful` (a `contentful.js` client, used to fetch
  audience + experience entries) or pre-fetched `entries`; throws if neither is given. When both
  are supplied, `entries` takes precedence and no Contentful fetch is made. Idempotent — re-invoking
  reuses the in-flight/completed attachment.
  source: preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanel; preview-panel#attachOptimizationPreviewPanel.ts#AttachOptimizationPreviewPanelArgs; preview-panel#lib/entries.ts#PreviewPanelEntries
- Validation: `pnpm implementation:run -- web-sdk typecheck`; `pnpm test:e2e:web-sdk`.
  source: impl:web-sdk#package.json
