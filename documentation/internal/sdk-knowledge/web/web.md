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

| Import path                                        | Purpose                                                                      | source                                                                                                                                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@contentful/optimization-web` (default export)    | `ContentfulOptimization` class                                               | web-sdk#index.ts; web-sdk#ContentfulOptimization.ts#ContentfulOptimization                                                                                                                              |
| `@contentful/optimization-web/web-components`      | `defineContentfulOptimizationElements()` + element/detail types              | web-sdk#web-components/index.ts#defineContentfulOptimizationElements                                                                                                                                    |
| `@contentful/optimization-web/api-schemas`         | Type guards incl. `isMergeTagEntry`                                          | web-sdk#api-schemas.ts; api-schemas#contentful/typeGuards.ts#isMergeTagEntry                                                                                                                            |
| `@contentful/optimization-web/constants`           | `ANONYMOUS_ID_COOKIE`, `DEFAULT_WEB_ALLOWED_EVENT_TYPES`, etc.               | web-sdk#constants.ts#DEFAULT_WEB_ALLOWED_EVENT_TYPES; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE                                                                                                         |
| `@contentful/optimization-web/logger`              | logger utilities                                                             | web-sdk#logger.ts                                                                                                                                                                                       |
| `@contentful/optimization-web/handoff`             | Browser handoff types, hydration target, and content/state hydration helpers | web-sdk#handoff.ts#BrowserOptimizationHandoff; web-sdk#handoff.ts#OptimizationHandoffHydrationTarget; web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoffState |
| `@contentful/optimization-web/analytics`           | Analytics-only runtime and analytics handoff hydration helper                | web-sdk#analytics.ts#initializeOptimizationAnalyticsRuntime; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff                                                                                   |
| `@contentful/optimization-web/presentation`        | Low-level root/entry presentation primitives used by framework wrappers      | web-sdk#presentation/index.ts; web-sdk#presentation/OptimizedEntryController.ts#OptimizedEntryController                                                                                                |
| `@contentful/optimization-web/tracking-attributes` | Presentation tracking-attribute resolver                                     | web-sdk#tracking-attributes.ts; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes                                                                        |

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
  - **Managed entry fetching:** Web inherits the shared opt-in ID/slug behavior through
    `CoreConfig.contentful`; see
    [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
    source: core-sdk#CoreBase.ts#CoreConfig; core-sdk#CoreBase.ts#ContentfulConfig; web-sdk#ContentfulOptimization.ts#OptimizationWebConfig; core-sdk#CoreStateful.ts#CoreStatefulConfig
- Browser handoff model: see [`../shared/concepts.md`](../shared/concepts.md#optimization-handoff).
  `hydrateOptimizationHandoff(sdk, handoff, options?)` accepts only content handoffs, validates
  `initialPageEvent`, enforces cache safety, hydrates state into the live SDK through Web handoff
  state hydration, and leaves page-event emission to the root or route tracker that consumes
  `initialPageEvent`. One `globalThis` generation shared by content and analytics entry points keeps
  only the newest hydration current even across duplicated CommonJS module graphs. An
  adapter-supplied `options.isCurrent` guard can additionally cancel route- or mount-owned work. An
  already-cancelled adapter call returns before acquiring authority. Successful interceptor output
  is checked against both authorities before state is applied, and an interceptor rejection from
  the current hydration rejects the hydration call.
  `@contentful/optimization-web/handoff` also exports
  `hydrateOptimizationHandoffState` as a public integration API for downstream SDKs and exceptional
  custom adapters, including frameworks without a first-party adapter. Undefined or empty handoff
  state still marks the Experience request state successful and clears stale browser content state
  by publishing `selectedOptimizations: undefined` and `changes: undefined` while leaving `profile`
  untouched. When fields are present, the helper awaits the Web SDK state interceptor, treats
  own-property presence as intentional, keeps input handoff fields when an interceptor omits them,
  applies own present `undefined` fields, and publishes only those present fields plus the content
  reset in one browser SDK batch. Core-backed targets use the purpose-specific public Core operation
  so this publication also fences older Experience responses without exposing writable signals.
  source: web-sdk#handoff.ts#OptimizationHandoffHydrationOptions; web-sdk#handoff.ts#OptimizationHandoffHydrationTarget; web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoffState; web-sdk#handoff-internal.ts#getHandoffRuntimeState; web-sdk#handoff-internal.ts#hydrateOptimizationHandoffStateInternal; web-sdk#handoff-internal.ts#isCurrentHydration; web-sdk#handoff-internal.ts#applyHydratedSignals; web-sdk#handoff-internal.ts#applySuccessfulEmptyHandoffHydration; core-sdk#handoff.ts#assertOptimizationCacheSafety
- `hydrateOptimizationHandoff()` treats profileless `static` and `public-permutation` handoffs as
  live-memory hydration: it publishes handoff `changes` / `selectedOptimizations` to browser signals
  while suppressing durable continuity persistence, so existing durable `LocalStore` continuity is
  preserved. Private request handoffs, or profile-backed handoffs that pass cache safety, follow
  normal signal persistence and can update durable continuity when persistence consent allows.
  source: web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#handoff.ts#shouldPreserveDurableContinuity; web-sdk#handoff-internal.ts#applyHydratedSignals; web-sdk#storage/durableContinuityPersistence.ts#suppressDurableContinuityPersistence; web-sdk#storage/LocalStore.ts#LocalStore

## Components & hooks

None (imperative class + Web Components; no React surface). Web Components element table:

| Element / symbol                         | Kind      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | source                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `defineContentfulOptimizationElements()` | registrar | Side-effect-free until called; registers the two custom elements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | web-sdk#web-components/index.ts#defineContentfulOptimizationElements                                                                                                                                                                                                                                                                                                           |
| `<ctfl-optimization-root>`               | element   | Attributes: `client-id`, `environment`, `hydration`, `locale`, `live-updates`. Properties: `defaults`, `api`, `contentful` (property-only; configures owned-root managed fetching), `trackEntryInteraction`, `sdk`, `onStatesReady`, `prefetchManagedEntries` (warms the SDK-managed entry cache once the root SDK is ready). Reuses `window.contentfulOptimization` automatically if present (`this.assignedSdk ?? getGlobalSdk()`); `sdk` prop supplies an explicit instance. Root-owned SDK defaults view/click/hover on. Events `ctfl-root-ready` / `ctfl-root-error`. | web-sdk#web-components/ContentfulOptimizationRootElement.ts#ContentfulOptimizationRootElement; web-sdk#web-components/ContentfulOptimizationRootElement.ts#prefetchManagedEntries; web-sdk#presentation/optimizationRootRuntime.ts#resolveTrackEntryInteractionOptions                                                                                                         |
| `<ctfl-optimized-entry>`                 | element   | Manual `baselineEntry`, managed `entry-id`, or managed `content-type` + `slug`; `slug-field` selects a custom slug field. Source attributes are observed, so changes refetch. Events `ctfl-entry-loading` / `ctfl-entry-resolved` / `ctfl-entry-error`.                                                                                                                                                                                                                                                                                                                    | web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryElement; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#baselineEntry; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#contentType; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#slug; web-sdk#web-components/ContentfulOptimizedEntryElement.ts#slugField |
| `ContentfulOptimizedEntryEventDetail`    | type      | `{ entry, metadata, resolvedData, selectedOptimization, selectedOptimizations, snapshot }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryEventDetail                                                                                                                                                                                                                                                                                  |

## Render / entry resolution

- Imperative managed methods inherit the shared ID/slug query, overload, cache, error, and handoff
  behavior. Both baseline-only and fetch-then-resolve methods support slug descriptors; multi-entry
  fetch and prefetch preserve their input order and duplicates.
  source: core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchContentfulEntries; core-sdk#CoreBase.ts#prefetchManagedEntries; core-sdk#CoreBase.ts#fetchOptimizedEntry
- The Web Component waits for both `content-type` and `slug` to be present, defaults `slug-field` to
  `slug`, and treats an empty slug attribute as a complete source so core reports the not-found
  error. With no manual baseline, combining a non-empty `entry-id` with a complete slug source emits
  `Optimized entry source cannot include both entryId and managedEntry.` once while the conflict
  persists and fetches neither; a supplied `baselineEntry` takes precedence. The element keeps
  `entry-id`, `content-type`, `slug`, and `slug-field` as flat attributes with matching properties,
  and `entryQuery` as a flat property, then translates a complete slug source into the controller's
  nested descriptor. Successful resolution and interaction attributes use the fetched entry's
  `sys.id`, and late results from earlier attribute combinations are ignored.
  source: web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryElement; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController
- Before a managed ID or slug fetch produces its baseline entry, `<ctfl-optimized-entry>` preserves
  caller-owned light-DOM content. It hides the host only while the root SDK is ready and hydration
  is not `preserve-server`; without a ready SDK it reveals the preserved content. A successful fetch
  transfers visibility control to optimized-entry presentation state: the temporary style is
  cleared when that state is visible, but remains hidden while presentation is still pending.
  source: web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryElement
- `resolveOptimizedEntry(baselineEntry, selectedOptimizations?)` →
  `{ entry, selectedOptimization?, optimizationContextId? }` (public `ResolvedData` shape). Omitting
  arg 2 defaults to `selectedOptimizationsSignal.value` (current SDK state).
  source: core-sdk#CoreBase.ts#resolveOptimizedEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#ResolvedData; core-sdk#CoreStateful.ts#resolveOptimizedEntry
- The live Web SDK and its snapshot runtime use the shared fallback-only merge-tag resolution:
  a configured fallback does not read browser or snapshot profile state and does not emit the
  missing-profile warning. See [`../shared/concepts.md`](../shared/concepts.md#entry-resolution).
  source: core-sdk#CoreBase.ts#getMergeTagFallbackValue; core-sdk#runtime/SnapshotRuntime.ts#getMergeTagFallbackValue; web-sdk#runtime.ts#createWebSnapshotRuntime
- Low-level presentation snapshots and tracking-attribute inputs carry one caller-supplied skeleton
  set across baseline, resolved-entry, and metadata views without changing runtime variant choice.
  Shared modeling and narrowing behavior: see
  [`../shared/concepts.md`](../shared/concepts.md#entry-resolution).
  source: web-sdk#presentation/OptimizedEntrySnapshot.ts#OptimizedEntrySnapshot; web-sdk#presentation/OptimizedEntryController.ts#OptimizedEntryController; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes; core-sdk#OptimizedEntryMetadata.ts#OptimizedEntryMetadata
- `<ctfl-optimized-entry>` maps an empty result to the host's native `hidden` state. The element stays
  connected with its tracking attributes and emits `ctfl-entry-resolved` with the full result, while
  caller-owned light-DOM nodes stay in place and become visible again when a later result is not
  empty. A change to only the empty-variant state still emits the resolved event.
  source: web-sdk#web-components/ContentfulOptimizedEntryElement.ts#ContentfulOptimizedEntryElement
- **Control-variant precision (subtle):** `selectedOptimization` is `undefined` ONLY when no
  experience matched — no selections, entry not optimized, no optimization entry, or no matching
  selection. When an experience matches but assigns the visitor to the CONTROL/baseline variant
  (`variantIndex === 0` → `resolveTo(entry)`), the returned `entry` equals the baseline YET
  `selectedOptimization` IS defined with `variantIndex: 0`. ⇒ Do not read
  `selectedOptimization === undefined` as "seeing baseline content."
  source: core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext; core-sdk#resolvers/OptimizedEntryResolver.ts#resolveTo
- `SelectedOptimization` fields: `experienceId`, `variantIndex`, `variants`, `sticky`.
  source: api-schemas#experience/optimization/SelectedOptimization.ts#SelectedOptimization
- Loading presentation treats content resolution and client presentation readiness independently.
  When low-level controller callers omit presentation readiness, it defaults to ready in a browser
  and pending in a server runtime. The default `client-only-hidden-until-ready` path stays pending
  while either content is loading or presentation is not ready, while entries without optimization
  references are presentation-ready immediately. The **5s** reveal timer follows that combined
  pending state, so settled optimized content waiting for presentation falls back to a visible
  baseline on timeout. `preserve-server` suppresses loading fallback, baseline-while-loading, and
  hidden layout target behavior and starts no reveal timer.
  source: web-sdk#presentation/OptimizedEntryLoadingPresentation.ts#resolveLoadingPresentation; web-sdk#presentation/OptimizedEntryController.ts#OptimizedEntryController

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
- When an accepted `page()` returns response data, that data belongs to its call, while shared
  personalization and `experienceRequestState` follow the concurrent stateful-response contract in
  [`../shared/concepts.md`](../shared/concepts.md#experience-response-payload); event-interceptor
  completion order and asynchronous state interception cannot let an older request overwrite newer
  route state.
  source: core-sdk#queues/ExperienceQueue.ts#ExperienceQueue; core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals
- `trackCurrentPage({ routeKey, buildPayload, initialPageEvent? })` returns an accepted result or a
  rejected result whose reason distinguishes an already accepted route, policy denial, and
  supersession. Same-key calls made while the current attempt is pending join its promise, so payload
  construction and event emission happen once and every joiner observes the owner outcome. Only
  consecutive acceptance is deduped; a different route supersedes the prior attempt by identity, so
  returning to an earlier key can emit again. Consent denial, an offline call, or going offline
  during asynchronous event interception resolves as `not-allowed` and leaves the route retryable.
  `trackCurrentPage` emissions are online-only and do not publish or enqueue an offline page; retry
  the current route explicitly after reconnecting. Ordinary `page()` calls still queue offline. A
  current operational failure rejects, and a stale success or rejection resolves as `superseded`.
  `initialPageEvent: 'skip'` accepts the current route without emitting for hybrid first-route
  dedupe; a bare `page()` always emits when consent permits.
  source: web-sdk#ContentfulOptimization.ts#TrackCurrentPageResult; web-sdk#ContentfulOptimization.ts#trackCurrentPage; core-sdk#tracking/CurrentStateCoordinator.ts#CurrentStateCoordinator; core-sdk#tracking/CurrentStateTracking.ts#CurrentStateTrackingResult
- `states.currentStateTracking` is the read-only advanced-integration view of Core's current route
  generation and idle/observed/pending/accepted lifecycle. The coordinator and every mutation
  operation remain internal.
  source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#tracking/CurrentStateTracking.ts#CurrentStateTrackingState; core-sdk#tracking/CurrentStateCoordinator.ts#CurrentStateCoordinator
- Current-page payload metadata treats the first accepted page after construction or reset as the
  initial-page boundary. `isInitialEmission` stays true until a page attempt is accepted or a
  server-emitted route is marked accepted with `initialPageEvent: 'skip'`; it stays false for later
  route emissions even if an intervening attempt is blocked. `reset()` opens a new initial-page
  boundary.
  source: web-sdk#ContentfulOptimization.ts#trackCurrentPage; web-sdk#ContentfulOptimization.ts#ContentfulOptimization
- Interaction tracking: SDK observes any DOM element carrying `data-ctfl-*`; auto view/click/hover
  on by default; opt out per-type via `autoTrackEntryInteraction`. Manual:
  `tracking.enableElement('views', el, { data, dwellTimeMs })` / `disableElement` / `clearElement`
  (manual data precedes attributes). Uses RESOLVED entry id.
  source: web-sdk#entry-tracking/EntryInteractionRuntime.ts#EntryInteractionRuntime; web-sdk#entry-tracking/resolveAutoTrackEntryInteractionOptions.ts#EntryInteractionApi; web-sdk#presentation/OptimizedEntryTrackingAttributes.ts#resolveOptimizedEntryTrackingAttributes
- Analytics-only handoff: `initializeOptimizationAnalyticsRuntime(config)` creates a narrow Web
  runtime with event tracking plus a read-only `states.currentStateTracking` view, but no
  content-resolution surface. Advanced integrations can observe the same current-route generation
  and lifecycle as the full Web SDK without receiving coordinator mutation authority. It removes the
  global browser SDK reference if construction registered this analytics runtime's own internal SDK
  instance. Hydration through `hydrateOptimizationAnalyticsHandoff`
  accepts only `hydration: 'analytics-only'`, hydrates handoff state, warns when a skipped initial
  page lacks profile continuity, then delegates initial route ownership to `trackCurrentPage()`.
  Shared global handoff authority means a newer analytics or content hydration supersedes older
  analytics work. Superseded analytics work stops before state apply, its warning, payload
  construction, or page tracking.
  Profileless `static` and `public-permutation` analytics handoffs suppress durable continuity
  persistence the same way content handoffs do.
  source: web-sdk#analytics.ts#OptimizationAnalyticsRuntime; web-sdk#analytics.ts#initializeOptimizationAnalyticsRuntime; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff; web-sdk#analytics.ts#warnSkippedInitialPageWithoutProfileContinuity; web-sdk#handoff-internal.ts#hydrateOptimizationHandoffStateInternal; web-sdk#handoff-internal.ts#isCurrentHydration; web-sdk#handoff.ts#shouldPreserveDurableContinuity
- Flags: `getFlag(name)` one-off and `states.flag(name)` reactive reads auto-attempt flag-view
  tracking; explicit/manual replacement is `trackFlagView()`. See
  [`../shared/concepts.md`](../shared/concepts.md#custom-flag-views).
  source: core-sdk#CoreStatefulEventEmitter.ts#getFlag; core-sdk#CoreStatefulEventEmitter.ts#getFlagObservable; core-sdk#CoreStatefulEventEmitter.ts#trackFlagView
- Analytics forwarding: subscribe to `states.eventStream` for accepted events and
  `states.blockedEventStream` for consent-blocked diagnostics; dedupe accepted events by
  `messageId`. Event-stream payloads carry each event's normal schema plus universal fields such as
  `messageId`, `channel`, `context`, and timestamps. See
  [`../shared/concepts.md`](../shared/concepts.md#stateful-event-forwarding-streams).
  source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#events/OptimizationEventStreamEvent.ts#OptimizationEventStreamEvent; core-sdk#events/BlockedEvent.ts#BlockedEvent; api-schemas#experience/event/UniversalEventProperties.ts#UniversalEventProperties; kb:shared/concepts.md

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
  constructed. BUT optimization state is empty until the latest-dispatched accepted
  `page()`/`identify()` response applies selections ⇒ resolve-before-emit yields baseline.
  Ordering: construct → emit → resolve.
  source: core-sdk#CoreStateful.ts#resolveOptimizedEntry; core-sdk#CoreStatefulEventEmitter.ts#page; core-sdk#queues/ExperienceQueue.ts#ExperienceQueue
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
- Preview overrides force audiences, variants, and inline-variable flag values by mutating
  stateful SDK signals from an API baseline; panel-open state forces optimized entries to
  live-update. See [`../shared/concepts.md`](../shared/concepts.md#preview-overrides).
  source: preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanelToSdk; core-sdk#preview-support/PreviewOverrideManager.ts#setVariantOverride; core-sdk#preview-support/applyChangeOverrides.ts#applyChangeOverrides; web-sdk#presentation/OptimizedEntryController.ts#resolveShouldLiveUpdate
- Validation: `pnpm implementation:run -- web-sdk typecheck`; `pnpm test:e2e:web-sdk`.
  source: impl:web-sdk#package.json
