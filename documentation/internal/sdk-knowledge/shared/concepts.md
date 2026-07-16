# Shared concepts (SDK-neutral)

SDK-neutral concepts that live in the shared `core-sdk` and so apply across the SDK families that
consume them — currently Web, React Web, both Next.js routers, Node, and React Native. Per-SDK files
reference these instead of restating them. A few entries are described with a web-oriented example
(e.g. a render prop); the underlying contract is the same across runtimes. Terse; not a guide.

## Entry-source boundary (managed or manual)

The app owns the Contentful client. Two supported ways to get a fetched entry to the SDK's
resolution hand-off:

- **Manual:** the app fetches the entry itself and passes it in (`baselineEntry` /
  `resolveOptimizedEntry(entry)`). The app keeps its client, fetchers, caching, and rendering.
- **Managed (opt-in):** the app hands the SDK its `contentful.js` client via `contentful` config
  (`contentful: { client, defaultQuery?, cache? }`); the SDK then fetches explicit entry IDs through
  that client (`fetchContentfulEntry(id)`, `fetchContentfulEntries(descriptors)`,
  `prefetchManagedEntries(descriptors)`, `fetchOptimizedEntry(id)`, `<OptimizedEntry entryId>`,
  `useOptimizedEntry({ entryId })`). The client is still app-owned; one uncached normalized entry
  uses `getEntry()`, multiple uncached entries with the same normalized query use `getEntries()`,
  and same-tick uncached single-entry calls with the same normalized query can share a
  `getEntries()` call. Large `getEntries()` fetches split into 100-ID chunks. The SDK merges
  `contentful.defaultQuery`, the per-entry query, an SDK or request locale fallback, and
  `include: 10`; it preserves descriptor order and duplicates. Per-instance cache defaults to
  `{ maxEntries: 100, ttlMs: 300_000 }`; `cache: false` disables it; `clearContentfulEntryCache()`
  clears it. Managed prefetch takes explicit descriptors only; already included nested entries
  remain part of the fetched `baselineEntry`.
  source: core-sdk#CoreBase.ts#ContentfulConfig; core-sdk#CoreBase.ts#ContentfulEntryClient; core-sdk#CoreBase.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchContentfulEntries; core-sdk#CoreBase.ts#prefetchManagedEntries; core-sdk#CoreBase.ts#clearContentfulEntryCache; core-sdk#managed-entry-fetcher.ts#ManagedEntryFetcher; core-sdk#CoreStatelessRequest.ts#prefetchManagedEntries

Either way, the SDK sits at the hand-off where a fetched entry becomes a component and returns the
resolved variant (or the baseline entry). Both paths are supported; a guide must not assert the SDK
never fetches. source: core-sdk#CoreBase.ts#ContentfulConfig

## Entry resolution

Fetch with ONE concrete locale and an `include` depth deep enough to cover the page, its sections,
and linked variant entries. All-locale payloads (`withAllLocales` / CDA `locale=*`) use locale-keyed
field maps the resolver cannot read ⇒ entries fall back to baseline. The entry wrapper's render prop
hands back the resolved entry as a base `contentful` `Entry`; a narrower component type needs a
cast.
source: react-web-sdk#optimized-entry/optimizedEntryUtils.ts#RenderProp; concept:entry-personalization-and-variant-resolution

Entry replacement depends on two fixed SDK content-model fields: a baseline entry's
`fields.nt_experiences` contains its linked Optimization experience entries, and each matching
experience's `fields.nt_variants` contains the linked replacement entries. These names are
SDK-owned, not application aliases. If either link is unresolved or absent from the fetched payload,
the resolver cannot select the authored replacement and returns baseline.
source: api-schemas#contentful/OptimizedEntry.ts#OptimizedEntryFields; api-schemas#contentful/OptimizationEntry.ts#OptimizationEntryFields; core-sdk#resolvers/OptimizedEntryResolver.ts#getOptimizationEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#getSelectedVariantEntry

Merge tags are a separate, profile-backed mechanism rather than entry replacement. Pass only a
value accepted by `isMergeTagEntry` to `getMergeTagValue`; the resolver reads the merge-tag selector
from `fields.nt_mergetag_id`, looks it up in the supplied/current profile, and falls back to
`fields.nt_fallback`. In a Contentful Rich Text renderer, the application owns extracting the
embedded entry target before applying the guard. Import `documentToReactComponents` from
`@contentful/rich-text-react-renderer`; import `INLINES` and Rich Text document types from
`@contentful/rich-text-types`.
source: api-schemas#contentful/typeGuards.ts#isMergeTagEntry; api-schemas#contentful/MergeTagEntry.ts#MergeTagEntryFields; core-sdk#resolvers/MergeTagValueResolver.ts#resolve; react-web-sdk#optimized-entry/optimizedEntryUtils.ts#OptimizedEntryRenderContext; impl:nextjs-sdk_app-router#components/EntryCardContent.tsx

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

## Page events

A page event signals a page/route view. Auto-page trackers emit them on navigation and dedupe
consecutive route keys. When the server already reported a consented page view, the browser must
skip the duplicate (per-SDK `initialPageEvent` / tracker prop). Interaction events
(view/click/hover) are consent-gated browser activity and use the resolved entry id.
source: react-web-sdk#auto-page/useAutoPageEmitter.ts; react-web-sdk#router/next-app.tsx

## Experience response payload

An accepted Experience API request (page/identify/screen/track) returns `OptimizationData`
`{ profile, selectedOptimizations, changes }` — this response is the origin of the profile, the
selected optimizations, and the computed flag `changes` the rest of the SDK consumes. `OptimizationData`
mirrors the wire `ExperienceData` but renames its `experiences` field to `selectedOptimizations`. A
stateful SDK applies the payload to its personalization signals (`profile`, `selectedOptimizations`,
`changes`) in one batch, transitioning the Experience-request state to `success` atomically with the
selections so consumers never see `!pending` while optimization is still unavailable; a stateless SDK
returns the same payload per request instead of holding it.
source: api-schemas#experience/ExperienceResponse.ts#OptimizationData; api-schemas#experience/ExperienceResponse.ts#ExperienceData; core-sdk#state/applyOptimizationDataToSignals.ts#applyOptimizationDataToSignals

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
generic helper reports cache-safety warnings instead of throwing. Node request handoff creation
throws a `TypeError` when request data with profile state is paired with `public-permutation` or
`static` cache metadata.
source: core-sdk#handoff.ts#OptimizationHandoff; core-sdk#handoff.ts#getOptimizationCacheSafetyWarnings; node-sdk#handoff.ts#createRequestHandoffFromData

`createHandoffFromSelections()` builds a selection handoff from application-owned selected
optimizations and optional managed-entry snapshots. It does not include profile state and requires
`selectedOptimizations` to be an array.
source: core-sdk#handoff.ts#createHandoffFromSelections

`createSelectionFingerprint()` returns a deterministic versioned fingerprint for selected
optimizations: `undefined` and an empty array have distinct sentinels, selections are sorted by
their formatted optimization fields, and each variant map is sorted by baseline entry id before
encoding. `createOptimizationCacheKey()` composes that fingerprint with cache scope, optional locale,
and sorted entry ids; missing locale or entry ids are encoded as `-`.
source: core-sdk#handoff.ts#createSelectionFingerprint; core-sdk#handoff.ts#createOptimizationCacheKey

`resolveEntriesForSelections()` resolves each supplied baseline entry with the same selected
optimizations, preserves the input entry order, and returns each resolved result with its original
baseline entry.
source: core-sdk#handoff.ts#resolveEntriesForSelections; core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext

Browser handoffs extend the core handoff with `hydration` and `initialPageEvent`. Content handoffs
are accepted by `hydrateOptimizationHandoff`; analytics-only handoffs are accepted by the analytics
runtime. Hydration copies `selectedOptimizations`, `changes`, and `profile` into the browser SDK and
marks the Experience request state successful when any state is present.
source: web-sdk#handoff.ts#BrowserOptimizationHandoff; web-sdk#handoff.ts#hydrateOptimizationHandoff; web-sdk#analytics.ts#hydrateOptimizationAnalyticsHandoff; web-sdk#handoff-state.ts#hydrateOptimizationSelectionState
