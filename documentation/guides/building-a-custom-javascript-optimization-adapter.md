---
title: Build a custom JavaScript Optimization adapter
fern:
  slug: build-a-custom-javascript-optimization-adapter
  section: Guides
  description: >-
    Use this guide when you are building a JavaScript runtime or framework adapter and no official
    Optimization SDK package fits that surface.
---

# Build a custom JavaScript Optimization adapter

Use this guide when you are building a JavaScript runtime or framework adapter and no official
Optimization SDK package fits that surface.

## Do you need this?

Do not build a custom adapter when Web, React Web, Next.js, Node, React Native, iOS, or Android
matches the application runtime. Those packages own rendering conventions, tracking integration,
consent defaults, route or screen lifecycle, preview behavior, and platform cleanup.

Build here only when you own an adapter layer that must compose Core primitives into a runtime the
Optimization SDK Suite does not already cover.

## Quick start

The `renderLoading()`, `renderError()`, `renderResolvedEntry()`, `clearResolvedEntry()`, and
`updateTrackingMetadata()` helpers below belong to your adapter. A resolver result's optional
`isEmptyVariant` field is `true` for the SDK renderer's no-content state; `entry` still retains the
baseline for tracking context. `clearResolvedEntry()` removes previous consumer output, while
`updateTrackingMetadata()` stores the full result for the adapter's tracking layer.

**Adapt this to your use case:**

```ts
import { CoreStateful } from '@contentful/optimization-core'
import { OptimizedEntrySourceController } from '@contentful/optimization-core/entry-source'

const optimization = new CoreStateful({
  clientId,
  environment,
  locale: appLocale,
  contentful: {
    client: contentfulClient,
    defaultQuery: { locale: appLocale },
  },
})

const source = new OptimizedEntrySourceController()

source.setSnapshotListener((snapshot) => {
  if (snapshot.isLoading) {
    renderLoading()
    return
  }

  if (snapshot.error) {
    renderError(snapshot.error)
    return
  }

  if (!snapshot.baselineEntry) return

  const resolved = optimization.resolveOptimizedEntry(snapshot.baselineEntry)
  updateTrackingMetadata(resolved)
  if (resolved.isEmptyVariant) {
    clearResolvedEntry()
    return
  }
  renderResolvedEntry(resolved.entry, resolved.selectedOptimization)
})

source.updateOptions({
  entryId: '4ib0hsHWoSOnCVdDkizE8d',
  entryQuery: { locale: appLocale },
  sdk: optimization,
  isSdkStateReady: true,
})
```

Verify that the adapter renders a loading state, then renders either the selected variant or the
baseline fallback for one entry.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Default recipe](#default-recipe)
  - [Configure Core](#configure-core)
  - [Drive source controller lifecycle](#drive-source-controller-lifecycle)
  - [Resolve and render](#resolve-and-render)
  - [Handle selected optimizations](#handle-selected-optimizations)
- [Runtime or vendor variants](#runtime-or-vendor-variants)
  - [Browser adapters](#browser-adapters)
  - [Core-only non-Web adapters](#core-only-non-web-adapters)
  - [One-shot server paths](#one-shot-server-paths)
- [Validate the integration](#validate-the-integration)
- [Governance notes](#governance-notes)
- [Related guides and concepts](#related-guides-and-concepts)

<!-- mtoc-end -->
</details>

## Default recipe

### Configure Core

Create the Contentful Delivery client in your application or adapter host, then pass it to Core:

```ts
const optimization = new CoreStateful({
  clientId,
  environment,
  locale: appLocale,
  contentful: {
    client: contentfulClient,
    defaultQuery: { locale: appLocale },
    cache: { maxEntries: 100, ttlMs: 300_000 },
  },
})
```

`contentful.defaultQuery` applies to every SDK-managed `getEntry()` and `getEntries()` call. Set
`contentful.cache: false` only when the host application must own all entry caching.

### Drive source controller lifecycle

Create one `OptimizedEntrySourceController` for each adapter instance that owns one entry source.
Call `updateOptions()` whenever adapter inputs change:

- Pass `baselineEntry` when the host already fetched the entry. It takes precedence over `entryId`.
- Pass `entryId`, optional `entryQuery`, an SDK with `fetchContentfulEntry()`, and
  `isSdkStateReady: true` when the adapter wants Core-managed fetching.
- Use `setSnapshotListener()` to schedule renders from loading, error, or `baselineEntry` snapshots.
- Use `getSnapshot()` when the runtime needs a synchronous current value.
- Call `disconnect()` when the adapter unmounts or disposes.

The controller keys managed fetches by `entryId + entryQuery`, waits in loading state until the SDK
is ready, ignores stale fetch results after source changes, and clears in-flight ownership on
disconnect. `createOptimizedEntryLoadingEntry(entryId)` is available when a framework needs a stable
placeholder `Entry` shape during loading.

For server prefetch, accept `ManagedEntryDescriptor` values and call
`prefetchManagedEntries(runtime, descriptors)`. Pass the resulting `ManagedEntryHandoff[]` to your
browser provider under the same key your adapter uses for handoff state.

### Resolve and render

The source controller only produces a baseline entry. After a snapshot contains `baselineEntry`,
call `resolveOptimizedEntry()` and inspect the full result before rendering. `isEmptyVariant` is
`true` for the SDK renderer's no-content state; the result keeps the baseline `entry` and selection
context for tracking, but the adapter must clear consumer output:

**Follow this pattern:**

```ts
const resolved = optimization.resolveOptimizedEntry(snapshot.baselineEntry)

function presentResolvedEntry(result: typeof resolved) {
  const { entry, isEmptyVariant, selectedOptimization } = result

  updateTrackingMetadata(result)
  if (isEmptyVariant) clearResolvedEntry()
  else renderResolvedEntry(entry, selectedOptimization)
}

presentResolvedEntry(resolved)
```

Render the baseline entry when no variant resolves. Missing selections, unmatched optimization
metadata, unresolved Contentful links, and out-of-range variants are fallback cases, not adapter
errors.

### Handle selected optimizations

Stateful Core can resolve from its current `selectedOptimizations` state when you omit the second
argument. Emit a profile-producing event such as `page()` or `identify()` before expecting fresh
personalization, and subscribe to `states.selectedOptimizations` when the adapter supports live
updates.

Stateless Core needs request-local selections. Use a request-bound `forRequest()` client when
available; it stores the latest accepted Experience response for that request. Root stateless
callers pass explicit `selectedOptimizations` to `resolveOptimizedEntry()` or
`fetchOptimizedEntry()`.

## Runtime or vendor variants

### Browser adapters

For browser adapters that build on `@contentful/optimization-web`, prefer
`@contentful/optimization-web/presentation` when you also need Web presentation helpers such as
tracking attribute generation. For Core-only browser adapters,
`@contentful/optimization-core/entry-source` manages only the entry source lifecycle.

After resolution, render Web tracking metadata yourself or register the element manually with
`optimization.tracking.enableElement(...)`. The entry-source controller does not emit `data-ctfl-*`
attributes.

### Core-only non-Web adapters

Non-Web adapters own their rendering and interaction model. Convert runtime view, click, hover, tap,
or screen behavior into the appropriate Core event calls, and pass the resolved entry plus
`selectedOptimization` metadata to your runtime-specific tracking layer.

### One-shot server paths

Use `fetchOptimizedEntry(entryId, options?)` instead of the source controller when there is no
mounted adapter lifecycle. It fetches the baseline entry through the configured `contentful.js`
client, resolves immediately, and returns the full result, including `baselineEntry`, `entry`,
`selectedOptimization`, and optional `isEmptyVariant`. Apply the same empty-result branch before
rendering.

## Validate the integration

- Confirm the adapter renders loading and error states without tracking placeholder content as the
  resolved entry.
- Confirm `baselineEntry` takes precedence over `entryId`.
- Confirm `entryId` changes or `entryQuery` changes do not render stale fetch results.
- Confirm stateful adapters re-resolve when selected optimizations change, if live updates are part
  of the adapter contract.
- Confirm an empty result clears consumer output without discarding the baseline entry or tracking
  metadata, and a later non-empty result renders again.
- Confirm custom Web adapters render valid `data-ctfl-*` attributes or call
  `tracking.enableElement(...)` after resolution.

You can exercise the empty-to-non-empty transition locally without creating an Optimization
fixture. Run this beside the presentation branch above while `snapshot.baselineEntry` is available.
Resolve once with the adapter's current local state, then create two synthetic presentation cases:
one with the literal `true` flag and one with the optional property omitted.

**Adapt this to your use case:** temporarily call the real `presentResolvedEntry()` twice. Put
breakpoints in your existing `updateTrackingMetadata()`, `clearResolvedEntry()`, and
`renderResolvedEntry()` functions, or observe their existing local UI/log output.

```ts
const sourceResult = optimization.resolveOptimizedEntry(snapshot.baselineEntry)
const { isEmptyVariant: _, ...nonEmptyResult } = sourceResult
const emptyResult = { ...nonEmptyResult, isEmptyVariant: true as const }

presentResolvedEntry(emptyResult)
console.assert(emptyResult.entry === nonEmptyResult.entry)
console.assert(emptyResult.selectedOptimization === nonEmptyResult.selectedOptimization)
console.assert(emptyResult.optimizationContextId === nonEmptyResult.optimizationContextId)

presentResolvedEntry(nonEmptyResult)
```

The first call must update metadata and clear output; the second must update metadata and render
`sourceResult.entry` again. The assertions confirm that the synthetic empty result retained the same
entry and selection metadata instead of replacing the full resolver result with `null`.

## Governance notes

Use one concrete Contentful CDA locale for entries passed to Optimization resolvers. Do not use
`contentful.js` `withAllLocales` or raw CDA `locale=*`; those responses produce locale-keyed field
maps instead of the direct field values the resolver expects.

The adapter owns rendering, tracking, consent UI, route or screen events, Experience API event
timing, Contentful client creation, and teardown policy. Core owns shared optimization state,
events, managed entry fetching when configured, and local entry resolution.

## Related guides and concepts

- [Choose the right SDK](./choosing-the-right-sdk.md) - Package selection before building a custom
  adapter.
- [Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md) -
  Resolver inputs, fallback behavior, and single-locale entry constraints.
- [Interaction tracking in Web SDKs](../concepts/interaction-tracking-in-web-sdks.md) - Web
  `data-ctfl-*` attributes and `enableElement(...)` mechanics.
- [Optimization Core SDK README](../../packages/universal/core-sdk/README.md) - Core package surface
  and entry-source subpath summary.
