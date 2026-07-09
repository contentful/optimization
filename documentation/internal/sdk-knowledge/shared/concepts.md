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

## Baseline fallback

On denied consent, no matching variant, unresolved links, or an all-locale payload, the render prop
receives the baseline (original) entry and the UI does not break. This is why an integration renders
correctly even before any variant is authored.
source: react-web-sdk#optimized-entry/OptimizedEntry.tsx#OptimizedEntry

## Consent & persistence

Two independent axes: `consent` (may personalize + send events) and `persistenceConsent` (may store
the profile-id cookie). Consent policy is app-owned: the app records the choice and the SDK reads it
(server-side per request, browser-side via seeded defaults). The consent record/cookie is
reader-owned; the profile-id cookie is SDK-owned.
source: core-sdk#StatefulDefaults.ts#consent; core-sdk#StatefulDefaults.ts#persistenceConsent; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE

## Live updates

Opt-in. Most content is fixed for a request's life, so re-resolution after load is off by default.
Turned on app-wide (factory `liveUpdates`) or per-entry; a per-entry value overrides the app-wide
default. Triggers: consent/identity/profile changes in the browser.
source: react-web-sdk#provider/LiveUpdatesProvider.tsx#LiveUpdatesProvider; react-web-sdk#hooks/useLiveUpdates.ts#useLiveUpdates

## Page events

A page event signals a page/route view. Auto-page trackers emit them on navigation and dedupe
consecutive route keys. When the server already reported a consented page view, the browser must
skip the duplicate (per-SDK `initialPageEvent` / tracker prop). Interaction events
(view/click/hover) are consent-gated browser activity and use the resolved entry id.
source: react-web-sdk#auto-page/useAutoPageEmitter.ts; react-web-sdk#router/next-app.tsx
