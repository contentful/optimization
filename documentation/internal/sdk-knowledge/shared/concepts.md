# Shared concepts (SDK-neutral)

SDK-neutral concepts that live in the shared `core-sdk` and so apply across the SDK families that
consume them — currently Web, React Web, both Next.js routers, Node, React Native, and the
bridge-backed iOS and Android SDKs where noted. Per-SDK files reference these instead of restating
them. A few entries are described with a web-oriented example (e.g. a render prop); the underlying
contract is the same across runtimes. Terse; not a guide.

## Entry-source boundary (managed or manual)

The app owns the Contentful client. Two supported ways to get a fetched entry to the SDK's
resolution hand-off:

- **Manual:** the app fetches the entry itself and passes it in (`baselineEntry` /
  `resolveOptimizedEntry(entry)`). The app keeps its client, fetchers, caching, and rendering.
- **Managed (opt-in):** the app hands the SDK its `contentful.js` client via `contentful` config;
  managed sources can identify an entry by ID or by content type plus slug. Slug lookup defaults the
  field to `slug`, always calls `getEntries()`, and merges the normal managed query before enforcing
  `content_type`, `fields.<slugField>`, and `limit: 2`; descriptor selectors therefore win over
  conflicting defaults or per-entry query values. ID lookup keeps the existing `getEntry()` path for
  one uncached entry, same-tick same-query ID batching through `getEntries()`, and 100-ID chunks. Both
  paths merge `contentful.defaultQuery`, the per-entry query, an SDK or request locale fallback, and
  `include: 10`, and use the per-instance cache (default `{ maxEntries: 100, ttlMs: 300_000 }`;
  `cache: false` disables it). Multi-entry calls preserve descriptor order and duplicates.
  Equivalent normalized slug descriptors share in-flight and cached promises; slug and ID keys
  cannot alias; rejected promises are evicted. Distinct slug descriptors each issue their own
  `getEntries()` request rather than joining ID batches or 100-ID chunks.
  `clearContentfulEntryCache()` clears cache records but does not cancel in-flight managed requests.
  Managed prefetch fetches only its explicit descriptors; linked entries already included in a
  fetched baseline remain part of that baseline.
  source: core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ManagedEntryDescriptor; core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchContentfulEntries; core-sdk#CoreBase.ts#clearContentfulEntryCache; core-sdk#managed-entry.ts#normalizeManagedEntryDescriptor; core-sdk#managed-entry-fetcher.ts#ManagedEntryFetcher; core-sdk#managed-entry-key.ts#getOptimizedEntrySourceKey

The imperative ID path accepts its query separately; the descriptor path carries `entryQuery` with
the managed source. `fetchOptimizedEntry` applies the separately supplied query only to the ID path,
while both paths fetch the baseline and resolve it with the supplied/current selections.
source: core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchOptimizedEntry; core-sdk#CoreStatelessRequest.ts#fetchOptimizedEntry

Framework component and hook surfaces accept the manual `baselineEntry` source and the flat managed
`entryId` + `entryQuery` source. Object descriptors, whether ID-based or slug-based, travel under
`managedEntry`; flat content-type/slug props are not a component or hook source. Their shared source
controller gives a supplied baseline precedence over managed sources. Without a baseline, combining
`entryId` and `managedEntry` fetches neither and exposes one stable
`Optimized entry source cannot include both entryId and managedEntry.` error snapshot until the
conflict clears. Source-key changes invalidate the prior request so late results are ignored.
source: core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntrySourceProps; react-web-sdk#optimized-entry/useOptimizedEntry.ts#UseOptimizedEntryParams; react-native-sdk#components/OptimizedEntry.tsx#OptimizedEntrySourceProps; react-native-sdk#hooks/useOptimizedEntry.ts#UseOptimizedEntryParams

Slug lookup rejects an empty `contentType` with
`TypeError: Managed Contentful entry contentType must not be empty.` and an empty `slugField` with
`TypeError: Managed Contentful entry slugField must not be empty.` before a CDA request. An empty or
unmatched slug throws `Contentful entry not found for content type "<contentType>" where
"fields.<slugField>" equals "<slug>".`; a response whose `total` or item count exceeds one throws
`Multiple Contentful entries found for content type "<contentType>" where "fields.<slugField>"
equals "<slug>".` A slug handoff nests its normalized lookup descriptor under `managedEntry` and
retains `entryId` as the fetched baseline's `sys.id`; browser handoff lookup indexes that baseline by
both the resolved ID and slug-source key. Framework source controllers likewise replace the
provisional slug source with the fetched `sys.id` and ignore stale results after a source change.
source: core-sdk#managed-entry-fetcher.ts#validateSlugDescriptor; core-sdk#managed-entry-fetcher.ts#fetchContentfulEntryBySlug; core-sdk#managed-entry.ts#createManagedEntryHandoffs; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; react-web-sdk#provider/OptimizationProvider.tsx#createPrefetchedManagedEntries

The app owns the content type, slug, and slug-field lookup values. After CDA resolution, the SDK uses
the fetched entry's `sys.id` for handoff identity, optimization metadata, and interaction tracking;
it does not treat the slug as an entry ID.
source: core-sdk#managed-entry.ts#createManagedEntryHandoffs; core-sdk#OptimizedEntrySourceController.ts#OptimizedEntrySourceController; react-web-sdk#optimized-entry/useOptimizedEntry.ts#useOptimizedEntry; react-native-sdk#hooks/useOptimizedEntry.ts#useOptimizedEntry

Either way, the SDK sits at the hand-off where a fetched entry becomes a component and returns the
resolved variant (or the baseline entry). Both paths are supported; a guide must not assert the SDK
never fetches. source: core-sdk#CoreBase.ts#ContentfulConfig

## Entry resolution

Fetch with ONE concrete locale and an `include` depth deep enough to cover the page, its sections,
and linked variant entries. All-locale payloads (`withAllLocales` / CDA `locale=*`) use locale-keyed
field maps the resolver cannot read ⇒ entries fall back to baseline.
source: core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext; api-schemas#contentful/typeGuards.ts#isResolvedOptimizedEntry; concept:entry-personalization-and-variant-resolution

Contentful GraphQL Content API responses are schema-shaped, not `contentful.js` Entry-shaped: the
generated schema exposes `sys`, `contentfulMetadata`, and typed content fields directly; Object
fields are `JSON`; single-entry links are selected by their field name; array links are selected
through generated `*Collection` fields; `locale`, `useFallbackLocale`, and `preview` arguments
cascade to resolved references unless overridden; GraphQL has no CDA `locale=*` wildcard. App-owned
GraphQL fetching stays on the manual side of the entry-source boundary.
source: extern:Contentful GraphQL Content API schema generation docs; extern:Contentful GraphQL Content API locale handling docs; extern:Contentful GraphQL Content API preview and collection fields docs; core-sdk#CoreBase.ts#ContentfulConfig

`resolveOptimizedEntry()` and the shared resolver guards consume a resolved Contentful Entry-like
object: `sys.type` must be `Entry`, `sys.id` and `sys.contentType.sys.id` must exist, and `metadata`
and `fields` must be objects. An optimized baseline must carry `fields.nt_experiences`; each usable
optimization entry under it must validate as `nt_experience` with SDK-owned `nt_name`, `nt_type`, and
`nt_experience_id` fields. Entry replacement can resolve to a variant only when `nt_config` describes
a matching component and variant entries in `nt_variants` are already resolved entries for the
selected variant ID. A resolved linked variant can use any content type; unresolved or structurally
invalid links return the baseline.
source: core-sdk#CoreBase.ts#resolveOptimizedEntry; api-schemas#contentful/typeGuards.ts#isResolvedContentfulEntry; api-schemas#contentful/typeGuards.ts#isResolvedOptimizedEntry; api-schemas#contentful/typeGuards.ts#isResolvedOptimizationEntry; api-schemas#contentful/OptimizedEntry.ts#OptimizedEntryFields; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntryFields; core-sdk#resolvers/OptimizedEntryResolver.ts#getOptimizationEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariantEntry

Entry resolution on Android and iOS uses this same contract. The native JavaScript bridge forwards the
baseline entry and selections to `CoreStateful.resolveOptimizedEntry` and serializes the Core result
without filtering it by content type.
source: optimization-js-bridge#index.ts#bridge; core-sdk#CoreStateful.ts#resolveOptimizedEntry

Entry-skeleton types are erased at runtime and do not affect variant choice. The resolver returns
any structurally resolved selected link regardless of content type.
source: core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariantEntry; extern:TypeScript type parameters are erased at runtime

`isEntryOfContentType` compares only `sys.contentType.sys.id`; it does not validate entry fields.
source: api-schemas#contentful/typeGuards.ts#isEntryOfContentType

GraphQL integrations that keep app-owned fetching must query enough optimization-owned fields
(`nt_experiences`, each linked `nt_experience` entry's `nt_name`, `nt_type`, `nt_config`,
`nt_variants`, and `nt_experience_id`, plus linked variant entries) and either reshape those GraphQL
results into the resolver's Entry-like object before calling the resolver or map the resolved
`entry.sys.id` back to the app's GraphQL-native objects. The SDK does not add a GraphQL client; the
managed fetch path calls the configured `contentful.js`-style `getEntry()` / `getEntries()` client.
source: core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#fetchOptimizedEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext; core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariantEntry; extern:Contentful GraphQL Content API schema generation docs

Entry replacement depends on two fixed SDK content-model fields: a baseline entry's
`fields.nt_experiences` contains its linked Optimization experience entries, and each matching
experience's `fields.nt_variants` contains the linked replacement entries. These names are
SDK-owned, not application aliases. If either link is unresolved or absent from the fetched payload,
the resolver cannot select the authored replacement and returns baseline.
source: api-schemas#contentful/OptimizedEntry.ts#OptimizedEntryFields; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntryFields; core-sdk#resolvers/OptimizedEntryResolver.ts#getOptimizationEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariantEntry

After an attached `nt_experience` entry matches a selection by
`selectedOptimization.experienceId === optimizationEntry.fields.nt_experience_id`, the resolver reads
that entry's `nt_config` to find a non-hidden EntryReplacement component whose baseline id equals the
baseline entry id. `variantIndex === 0` returns the baseline with selected-optimization metadata;
positive variant indexes are one-based into that component's `variants`. Missing config/components,
a hidden baseline component, an out-of-range or invalid selected variant, or a linked variant in
`nt_variants` that is unresolved or structurally invalid returns the baseline. An empty variant
(`id === ""`) returns the baseline with `isEmptyVariant: true`.
source: core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedOptimization; core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariant; core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariantEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext; api-schemas#contentful/OptimizationConfig.ts#normalizeOptimizationConfig

`SelectedOptimization.variants` is not read during entry resolution; public cache identity includes
it through the selection fingerprint. Keep it consistent with the source selection because cache
keys can change when the variant map changes even though the resolver chooses from `nt_config` and
`nt_variants`.
source: core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariant; core-sdk#handoff.ts#formatVariants; core-sdk#handoff.ts#createSelectionFingerprint; api-schemas#experience/optimization/SelectedOptimization.ts#SelectedOptimization

The JavaScript core's merge tags are a separate, profile-backed mechanism rather than entry
replacement.
`getMergeTagValue` validates the entry, reads the merge-tag selector from `fields.nt_mergetag_id`
against the supplied/current profile, and falls back to `fields.nt_fallback`; an invalid entry or
missing/invalid profile emits its corresponding resolution warning. `getMergeTagFallbackValue`
validates the same entry and returns its configured `fields.nt_fallback` without consulting a
supplied/current profile or emitting the missing-profile warning. In a Contentful Rich Text
renderer, the application owns extracting the embedded entry target before applying the guard.
Import `documentToReactComponents` from `@contentful/rich-text-react-renderer`; import `INLINES`
and Rich Text document types from `@contentful/rich-text-types`.
source: api-schemas#contentful/typeGuards.ts#isMergeTagEntry; api-schemas#contentful/MergeTagEntry.ts#MergeTagEntryFields; core-sdk#CoreBase.ts#getMergeTagValue; core-sdk#CoreBase.ts#getMergeTagFallbackValue; core-sdk#CoreStatefulEventEmitter.ts#getMergeTagValue; core-sdk#runtime/SnapshotRuntime.ts#getMergeTagValue; core-sdk#runtime/SnapshotRuntime.ts#getMergeTagFallbackValue; core-sdk#resolvers/MergeTagValueResolver.ts#MergeTagValueResolver; react-web-sdk#optimized-entry/optimizedEntryUtils.ts#OptimizedEntryRenderContext; impl:nextjs-sdk_app-router#components/EntryCardContent.tsx

Resolution itself does NOT read consent. The resolver takes only `(entry, selectedOptimizations)` and
returns variant-or-baseline purely from whether a selection matches; consent gates event _emission_
(and therefore whether selections ever populate), never the resolve call. So a resolved entry can be
returned before any explicit consent decision — an entry resolves to baseline-or-variant regardless of
consent state, and denied/undecided consent surfaces as "no selections ⇒ baseline", not as a blocked
resolution.
source: core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext; core-sdk#CoreBase.ts#resolveOptimizedEntry

## Baseline fallback

When no matching selection exists, links are unresolved, or the payload is all-locale, the render
prop receives the baseline (original) entry and the UI does not break. Denied or undecided event
consent is one reason no accepted response may have populated selections; it is not an input to the
resolver itself. This is why an integration renders correctly even before any variant is authored.
source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry

## Consent & persistence

Two independent axes: `consent` (may personalize + send events) and `persistenceConsent` (may store
the profile-id cookie). Consent policy is app-owned: the app records the choice and the SDK reads it
(server-side per request, browser-side via seeded defaults). The consent record/cookie is
reader-owned; the profile-id cookie is SDK-owned.
source: core-sdk#StatefulDefaults.ts#consent; core-sdk#StatefulDefaults.ts#persistenceConsent; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE

With no configured `defaults.consent` and nothing persisted, the resolved `consent` default is
`undefined` (not `false`) — a not-yet-decided state, distinct from an explicit denial;
`persistenceConsent` falls back `defaults.persistenceConsent ?? defaults.consent ?? persisted`, so
it is likewise `undefined` when unset. The pre-consent allow-list (`allowedEventTypes`, defaulting to
`['identify','page']`) still admits `page`/`identify` while consent is `undefined` — `hasEventConsent`
returns `true` for an allow-listed method when `consent !== true`, so an undecided visitor can emit
`page` without an explicit consent call.
source: core-sdk#StatefulDefaults.ts#resolveStatefulDefaults; core-sdk#consent/ConsentPolicy.ts#hasEventConsent

## Live updates

Opt-in. Most content is fixed for a request's life, so re-resolution after load is off by default.
Turned on app-wide through root or binding `liveUpdates` configuration, or per-entry; a per-entry
value overrides the app-wide default. Triggers: consent/identity/profile changes in the browser.
source: react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#hooks/useLiveUpdates.ts#useLiveUpdates

## Stateful runtime lifecycle

Every `CoreStateful`-backed JavaScript SDK participates in one `globalThis` lock. One runtime can
therefore have only one live stateful owner across Web, React Native, and bridge-backed native
adapters; construction fails while another owner holds the lock. `destroy()` disposes every
registered Core effect and platform resource in LIFO order before releasing ownership. SDK-owned
cleanup callbacks are synchronous, non-throwing, and non-reentrant; cleanup does not isolate a
callback that violates that contract, although singleton release remains protected by `finally`.
Web registers its entry-interaction runtime, online/visibility listeners, persistence effects, and
browser-global cleanup with that Core lifecycle. React Native registers its persistence interceptor,
online/AppState listeners, active-instance cleanup, and AsyncStorage drain with the same lifecycle.
A Core, Web, or React Native constructor failure after acquisition runs the same rollback for every
resource registered before the failure and releases ownership. Structural adapter targets and
snapshot or stateless runtimes do not create a second live stateful owner or weaken this constraint.
source: core-sdk#CoreStateful.ts#CoreStateful; core-sdk#CoreStateful.ts#registerEffect; core-sdk#CoreStateful.ts#registerDisposer; core-sdk#CoreStateful.ts#disposeRegisteredResources; core-sdk#CoreStateful.ts#destroy; web-sdk#ContentfulOptimization.ts#ContentfulOptimization; web-sdk#ContentfulOptimization.ts#destroy; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization; react-native-sdk#ContentfulOptimization.ts#destroy; core-sdk#lib/singleton/StatefulRuntimeSingleton.ts#acquireStatefulRuntimeSingleton; core-sdk#lib/singleton/StatefulRuntimeSingleton.ts#releaseStatefulRuntimeSingleton; core-sdk#runtime/SnapshotRuntime.ts#SnapshotRuntime; core-sdk#CoreStatelessRequest.ts#CoreStatelessRequest; web-sdk#handoff.ts#OptimizationHandoffHydrationTarget

The bridge-backed iOS and Android runtime is transactional around the same Core lifetime. It does
not publish a new active bridge runtime until the Core instance, preview override manager, state and
event effects, and subscription registry have all been created. Under the same synchronous,
non-throwing cleanup contract, construction failure rolls back acquired resources in LIFO order and
clears bridge module state. Destroy detaches the active runtime first, unsubscribes flag observers,
runs resource cleanup in LIFO order, and clears module state; reinitialization destroys the prior
runtime before constructing its replacement. There is no per-cleanup exception isolation.
source: optimization-js-bridge#index.ts#createBridgeRuntime; optimization-js-bridge#index.ts#disposeBridgeRuntime; optimization-js-bridge#index.ts#clearBridgeModuleState; optimization-js-bridge#index.ts#initialize; optimization-js-bridge#index.ts#destroy

## API audiences and bridge boundary

Published SDK surfaces include application-facing consumer APIs and public integration APIs whose
primary audience is downstream SDKs. The latter remain available for exceptional custom
integrations and unsupported frameworks. Handoff hydration uses purpose-specific public operations
that preserve lifecycle currentness, state interception, and Core request-publication authority
without exposing raw writable signal handles.
source: core-sdk#CoreStateful.ts#CoreStateful; web-sdk#handoff.ts#OptimizationHandoffHydrationTarget; web-sdk#handoff.ts#hydrateOptimizationHandoffState; web-sdk#handoff-internal.ts#applyHydratedSignals

Core bridge support is preview-only. Preview tooling receives controlled writable signals and state
interceptor access because it must synthesize immediate local override state. The bridge is not a
general private channel for downstream SDK coordination; non-preview integration uses public,
purpose-specific operations instead.
source: core-sdk#bridge-support/coreBridgeCapabilities.ts#PreviewPanelBridge; core-sdk#bridge-support/coreBridgeCapabilities.ts#CoreBridgeCapabilities; core-sdk#bridge-support/capabilities.ts#installCoreBridgeCapabilities; preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanelToSdk; core-sdk#preview-support/PreviewOverrideManager.ts#PreviewOverrideManager

## Page events

A page event signals a page/route view. Auto-page trackers emit them on navigation and dedupe
consecutive accepted route keys. The Web current-page API returns accepted results or a rejected
result whose reason distinguishes an already accepted key, policy denial, and supersession; React
Native and bridge-backed native screen APIs project those outcomes to their existing event-result
shape. A same-key call joins the current pending attempt and observes its owner outcome. A different
key advances one scalar generation even when policy denies the new call, so an A1 → B → A2 sequence
can accept A2 regardless of completion order. Only the current attempt can become accepted or
propagate an operational rejection; a stale success or rejection resolves as superseded. Going
offline during asynchronous event interception resolves as policy denial. Consent- or
connectivity-blocked attempts remain observed and retryable. When the server
already reported a consented page view, the browser marks that route accepted without emitting (the
per-SDK `initialPageEvent` / tracker prop). Ordinary `page()` and `screen()` calls remain outside
current-route deduplication and still queue while offline. Current-page and current-screen emissions
are online-only: an offline attempt is neither published nor enqueued, and the caller must retry it
explicitly after reconnecting. Interaction events (view/click/hover) are consent-gated browser
activity and use the resolved entry id.
source: core-sdk#tracking/CurrentStateCoordinator.ts#CurrentStateCoordinator; core-sdk#tracking/CurrentStateTracking.ts#CurrentStateTrackingResult; core-sdk#queues/ExperienceQueue.ts#ExperienceQueue; core-sdk#CoreStatefulEventEmitter.ts#CoreStatefulEventEmitter; web-sdk#ContentfulOptimization.ts#trackCurrentPage; react-native-sdk#ContentfulOptimization.ts#ContentfulOptimization; optimization-js-bridge#index.ts#BridgeCoreStateful; react-web-sdk#auto-page/useAutoPageEmitter.ts#useAutoPageEmitter

Current-route ownership is internal to Core. The coordinator publishes only a read-only
`states.currentStateTracking` observable whose scalar generation and lifecycle status let advanced
integrations observe idle, observed, pending, or accepted state. It exposes no public mutation,
invalidation listener, or lease. Advancing the current route or screen generation synchronously
invalidates all older Experience response authority, including ordinary requests, and resets the
shared Experience request state to `idle`. Snapshot runtimes expose the same current-state surface
fixed at idle.
source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#CoreStateful.ts#CoreStateful; core-sdk#tracking/CurrentStateTracking.ts#CurrentStateTrackingState; core-sdk#tracking/CurrentStateCoordinator.ts#CurrentStateCoordinator; core-sdk#queues/ExperienceQueue.ts#ExperienceQueue; core-sdk#runtime/SnapshotRuntime.ts#SnapshotRuntime

## Custom flag views

Custom Flag names are application/content-config identifiers, not SDK-fixed names. `getFlag(name)`
and `states.flag(name)` match `name` exactly against the current `Variable` change keys; preview
changes copy the configured inline-variable component key. Application lookups must therefore use
the configured Custom Flag key exactly.
source: core-sdk#CoreBase.ts#getFlag; core-sdk#resolvers/FlagsResolver.ts#FlagsResolver; api-schemas#contentful/OptimizationConfig.ts#InlineVariableComponent; core-sdk#preview-support/applyChangeOverrides.ts#applyChangeOverrides

Stateful flag reads auto-attempt flag-view tracking: `getFlag(name)` tracks the read immediately,
and `states.flag(name)` tracks `.current`, `subscribe()`, and `subscribeOnce()` reads. The explicit
manual equivalent is `trackFlagView()`, which builds a `component` view event with
`componentType: 'Variable'`.
source: core-sdk#CoreStatefulEventEmitter.ts#getFlag; core-sdk#CoreStatefulEventEmitter.ts#getFlagObservable; core-sdk#CoreStatefulEventEmitter.ts#trackFlagView; core-sdk#events/EventBuilder.ts#buildFlagView

Auto flag-view attempts require consent for `trackFlagView` and a current profile id. A pre-consent
or pre-profile flag read does not suppress a later accepted same-value track, active
`states.flag(name)` subscriptions re-attempt when tracking becomes allowed, and accepted attempts are
deduped by flag value, component id, experience id, variant index, and profile id.
source: core-sdk#CoreStatefulEventEmitter.ts#attemptFlagViewTracking; core-sdk#CoreStatefulEventEmitter.ts#initializeFlagViewConsentEffect; core-sdk#CoreStatefulEventEmitter.ts#buildFlagViewTrackingSignature

## Stateful event forwarding streams

Stateful JS SDK event forwarding is a current-value signal surface, not a durable event queue.
`states.eventStream` emits the most recent accepted Experience or Insights event after event
interceptors and schema validation; `states.blockedEventStream` emits only consent-blocked calls as
`{ reason: 'consent', method, args }`. Both observables emit the current value immediately on
subscribe and then later signal updates; the exposed streams keep only the latest accepted or
blocked event value while Experience/Insights delivery queues remain internal. A late subscriber
must dedupe from the events it observes; the SDK does not replay a full event history through these
observables. Concurrent Experience sends publish in post-interceptor admission order, so a delayed
earlier call can appear after a later call; this stream order does not transfer response ownership
to that delayed call. Blocked callback failures are logged rather than thrown.
source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#CoreStateful.ts#CoreStateful; core-sdk#signals/Observable.ts#toObservable; core-sdk#signals/signals.ts#event; core-sdk#signals/signals.ts#blockedEvent; core-sdk#queues/ExperienceQueue.ts#ExperienceQueue; core-sdk#queues/InsightsQueue.ts#InsightsQueue; core-sdk#events/BlockedEvent.ts#BlockedEvent; core-sdk#CoreStatefulEventEmitter.ts#reportBlockedEvent

Event-stream payloads carry each event's normal schema plus universal event fields such as
`messageId`, `channel`, `context`, and timestamps. Optimized-entry interactions add `optimization`
context only to the stream payload, not to the strict API payload. Flag-view stream events are not
enriched with `optimization`.
source: api-schemas#experience/event/UniversalEventProperties.ts#UniversalEventProperties; core-sdk#queues/ExperienceQueue.ts#send; core-sdk#queues/InsightsQueue.ts#send; core-sdk#events/OptimizationEventStreamEvent.ts#OptimizationEventStreamEvent

The runtime event stream is model-agnostic because one long-lived stream carries interactions for
entries of every content type. Its optimization context retains baseline and resolved entries, but
resolver-specific entry modeling cannot flow into a later event emission; consumers narrow each
resolved entry with `isEntryOfContentType` at the point of use.
source: core-sdk#CoreStateful.ts#CoreStates; core-sdk#events/OptimizationEventStreamEvent.ts#EventOptimizationContext; core-sdk#events/OptimizationEventStreamEvent.ts#OptimizationEventStreamEvent; api-schemas#contentful/typeGuards.ts#isEntryOfContentType

Consent-blocked stateful events stop before API delivery or queueing: Experience methods return
`{ accepted: false }`, Insights methods return without enqueueing, and Core writes only
`blockedEventStream` / `onEventBlocked` diagnostics. `consent(true)` changes future policy but does
not replay blocked diagnostics or rebuild the blocked call. Current-page/screen trackers do not mark
blocked attempts as accepted, so a later caller/effect can retry the same current key and build a
fresh payload under the current consent state.
source: core-sdk#CoreStatefulEventEmitter.ts#sendExperienceEventWithResult; core-sdk#CoreStatefulEventEmitter.ts#sendInsightsEvent; core-sdk#CoreStatefulEventEmitter.ts#reportBlockedEvent; core-sdk#CoreStateful.ts#consent; core-sdk#tracking/CurrentStateCoordinator.ts#CurrentStateCoordinator; web-sdk#ContentfulOptimization.ts#trackCurrentPage; optimization-js-bridge#index.ts#Bridge

## Experience response payload

An accepted Experience API request (page/identify/screen/track) returns `OptimizationData`
`{ profile, selectedOptimizations, changes }` — this response is the origin of the profile, the
selected optimizations, and the computed flag `changes` the rest of the SDK consumes. `OptimizationData`
mirrors the wire `ExperienceData` but renames its `experiences` field to `selectedOptimizations`. A
stateful SDK applies the payload to its personalization signals (`profile`, `selectedOptimizations`,
`changes`) in one batch, transitioning the Experience-request state to `success` atomically with the
selections so consumers never see `!pending` while optimization is still unavailable. Concurrent
stateful response ownership uses invocation-ordered request ids. Sends reserve an id before
asynchronous event interception, while event-stream publication and API delivery occur after
interception and can therefore start out of invocation order. When API delivery starts, a higher id
becomes the latest response authority and publishes `pending`; a lower id cannot displace it. Only a
response that still owns authority and whose shared Experience-request state remains `pending` runs
state interceptors; both conditions are checked again after asynchronous state interception before
personalization plus `success` is applied. Authoritative browser handoff state hydration also
publishes `success`, so older in-flight Experience responses cannot overwrite the hydrated state.
Only the current request's failure publishes `failed`. Older dispatched calls still resolve or
reject with their own outcome without overwriting signals.
Current-route requests additionally require their scalar generation to remain current. A current
send that becomes stale during event interception stops before event-stream publication or API
delivery; an online request that already started can finish but cannot apply its response or
failure. Advancing the route or screen generation advances the shared request order and resets the
Experience request state to `idle`, so no earlier ordinary or current response can apply afterward.
A later Experience call acquires response authority through the normal invocation order and can
publish `pending` and apply its result.
Manual and reconnect flushes start the Experience replay before awaiting the Insights drain, so a
later current-route send can acquire newer authority without being overwritten by queued replay.
`reset()` and `destroy()` invalidate already-started Experience requests, so their later responses
or failures cannot mutate personalization or request-state signals. Each acquired owner initializes
the shared Experience request state to `idle`; destroy restores `idle` after invalidation before
releasing ownership, so a replacement never inherits the prior owner's `pending` state. Stateful
Core state interceptors are field-presence aware: omitted interceptor fields keep the original
payload field, while an own present `undefined` field is applied intentionally. A stateless SDK
returns the same payload per request instead of holding it.
source: api-schemas#experience/ExperienceResponse.ts#OptimizationData; api-schemas#experience/ExperienceResponse.ts#ExperienceData; core-sdk#queues/ExperienceQueue.ts#ExperienceQueue; core-sdk#CoreStateful.ts#CoreStateful; core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals; web-sdk#handoff-internal.ts#applyHydratedSignals

Event-method acceptance and response data are separate: `EventEmissionResult` is
`{ accepted: false } | { accepted: true, data?: OptimizationData }`. An accepted queued/offline
event can therefore have no `data` yet; only a returned `data` value contains the profile,
selections, and changes described above.
source: core-sdk#events/EventEmissionResult.ts#EventEmissionResult; core-sdk#CoreStatefulEventEmitter.ts#sendExperienceEventWithResult

## Optimization handoff

`OptimizationHandoff` is the framework-neutral handoff shape for server, static, and edge rendered
Optimization state. It can carry selected state (`selectedOptimizations`, `changes`, optional
`profile`), managed-entry baseline snapshots, and cache metadata. Public/static handoffs must not
carry request-derived profile state; public permutations need an application-owned `cache.key`. The
generated public-permutation `cache.key` is SDK identity and transport metadata, while framework
tags are caller-owned invalidation labels. The generic helper reports cache-safety warnings instead
of throwing. Node request handoff creation
throws a `TypeError` when request data with profile state is paired with `public-permutation` or
`static` cache metadata.
source: core-sdk#handoff.ts#OptimizationHandoff; core-sdk#handoff.ts#createPublicPermutationCacheMetadata; core-sdk#handoff.ts#getOptimizationCacheSafetyWarnings; node-sdk#handoff.ts#createRequestHandoffFromData

`createHandoffFromSelections()` builds a selection handoff from application-owned selected
optimizations and optional managed-entry snapshots. It does not include profile state and requires
`selectedOptimizations` to be an array.
source: core-sdk#handoff.ts#createHandoffFromSelections

`createHandoffFromSelections()` serializes caller-supplied selected optimizations, changes, entries,
and cache metadata into the handoff. It does not call the Experience API or derive selections from
route, cookie, header, locale, or cache-key inputs. Next.js public-permutation helpers only add
browser handoff metadata and create cache metadata around the same caller-supplied selections.
source: core-sdk#handoff.ts#createHandoffFromSelections; nextjs-sdk#handoff.ts#createPublicPermutationHandoff; nextjs-sdk#handoff.ts#createPublicPermutationCacheMetadata

`createSelectionFingerprint()` returns a deterministic versioned fingerprint for selected
optimizations: `undefined` and an empty array have distinct sentinels, selections are sorted by
their formatted optimization fields using JS code-unit order, and each variant map is sorted by
baseline entry id using the same code-unit order before encoding. `createOptimizationCacheKey()`
composes that fingerprint with cache scope, optional locale, and code-unit-sorted entry ids; missing
locale or entry ids are encoded as `-`. It does not fingerprint Custom Flag `changes`; cacheable
renders that output Custom Flag values need an app-owned key, cache version, or tag dimension for
those rendered changes.
source: core-sdk#handoff.ts#createSelectionFingerprint; core-sdk#handoff.ts#createOptimizationCacheKey; core-sdk#handoff.ts#createHandoffFromSelections

`resolveEntriesForSelections()` resolves each supplied baseline entry with the same selected
optimizations, preserves the input entry order, and returns each resolved result with its original
baseline entry.
source: core-sdk#handoff.ts#resolveEntriesForSelections; core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext

Browser handoffs extend the core handoff with `hydration` and `initialPageEvent`. Content handoffs
are accepted by `hydrateOptimizationHandoff`; analytics-only handoffs are accepted by the analytics
runtime. Both hydration paths validate `initialPageEvent` and enforce cache safety before state is
published. Browser SDK state hydration is Web handoff-owned: `@contentful/optimization-web/handoff`
exports `hydrateOptimizationHandoffState` as a public integration API for downstream SDKs and
exceptional custom adapters; that helper awaits the Web SDK state interceptor only when handoff
state contains present `selectedOptimizations`, `changes`, or `profile` own fields, keeps input
handoff fields when an interceptor omits them, applies own present `undefined` fields intentionally,
and marks the Experience request state successful even for undefined or empty handoff state. Content
handoff state hydration starts from a content reset for `selectedOptimizations` and `changes`, so a
new content-capable handoff that omits those fields clears stale browser content state while
preserving `profile` unless `profile` is an own field. On a Core-backed target, the public raw-state
and content helpers use a purpose-specific Core operation to invalidate older Experience request
authority in the same batch as signal publication; structural targets have no queue to invalidate.
source: web-sdk#handoff.ts#BrowserOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoffState; web-sdk#handoff-internal.ts#applyHydratedSignals; web-sdk#handoff-internal.ts#applySuccessfulEmptyHandoffHydration; core-sdk#CoreStateful.ts#CoreStateful; core-sdk#handoff.ts#assertOptimizationCacheSafety

One `globalThis` hydration generation is authoritative across duplicated CommonJS module graphs and
both content and analytics hydration entry points. An already-cancelled adapter operation returns
before claiming hydration authority. Every other hydration advances the generation and remains
current only while it is newest and the optional adapter `isCurrent` guard passes. A newer content
or analytics hydration supersedes older work. Successful interceptor output is checked for
currentness again before it can mutate browser state; an interceptor rejection from the current
hydration rejects the hydration call. Analytics proceeds to its warning and page-tracking phase only
when shared hydration reports that it applied while still current, so superseded analytics work
cannot build or emit a page event.
source: web-sdk#handoff.ts#OptimizationHandoffHydrationOptions; web-sdk#handoff.ts#OptimizationHandoffHydrationTarget; web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoffState; web-sdk#handoff-internal.ts#getHandoffRuntimeState; web-sdk#handoff-internal.ts#hydrateOptimizationHandoffStateInternal; web-sdk#handoff-internal.ts#isCurrentHydration; web-sdk#handoff-internal.ts#applyHydratedSignals; web-sdk#handoff-internal.ts#applySuccessfulEmptyHandoffHydration; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff

React Web's `OptimizationProvider`, including framework adapters that delegate to it, lets a handoff
object seed only its first route occurrence. Reusing that object after another route gets no
snapshot, while a fresh object is claimable even when the route key is unchanged; claimed objects
are held weakly for the provider mount.
source: web-sdk#handoff.ts#ContentOptimizationHandoff; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationHandoffProps; react-web-sdk#provider/OptimizationProvider.tsx#OptimizationProvider

Snapshot and preview-override paths consume selection state, not necessarily a full Experience
response: snapshot runtimes resolve from whichever `selectedOptimizations`, `changes`, and `profile`
fields are present, while preview overrides update their clean baselines only from own present
`selectedOptimizations` and `changes` fields. Omitted refresh fields leave the cached baseline
unchanged; own present `undefined` is a resettable baseline, and override derivation falls back to
empty arrays only when no baseline exists.
source: core-sdk#runtime/SnapshotRuntime.ts#SnapshotRuntime; core-sdk#preview-support/PreviewOverrideManager.ts#PreviewOverrideManager; core-sdk#CoreBase.ts#LifecycleInterceptors

## Preview overrides

The web preview panel attaches through the SDK bridge, registers a `PreviewOverrideManager`, and
mutates the stateful SDK's `selectedOptimizations` and `changes` signals from a clean API baseline
plus current overrides. Opening the panel sets `previewPanelOpen`, which forces optimized entries to
live-update while the panel is open.
source: preview-panel#attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanelToSdk; core-sdk#bridge-support/capabilities.ts#installCoreBridgeCapabilities; core-sdk#preview-support/PreviewOverrideManager.ts#syncOverridesToSignal; web-sdk#presentation/OptimizedEntryController.ts#resolveShouldLiveUpdate

Audience overrides activate all associated experiences at variant index `1` or deactivate them at
variant index `0`; single-experience overrides replace that experience's `variantIndex`, appending a
selection with an empty `variants` map when the API baseline did not include it. Reset restores the
cached API baseline.
source: core-sdk#preview-support/PreviewOverrideManager.ts#activateAudience; core-sdk#preview-support/PreviewOverrideManager.ts#deactivateAudience; core-sdk#preview-support/PreviewOverrideManager.ts#setVariantOverride; core-sdk#preview-support/applyOptimizationOverrides.ts#applyOptimizationOverrides; core-sdk#preview-support/PreviewOverrideManager.ts#resetAll

Inline-variable preview overrides are represented as `Variable` changes so `getFlag()` and
`states.flag(name)` resolve the preview-selected value; variant index `0` and out-of-range variant
indexes use the component baseline value.
source: core-sdk#preview-support/applyChangeOverrides.ts#applyChangeOverrides; core-sdk#preview-support/PreviewOverrideManager.ts#deriveChanges
