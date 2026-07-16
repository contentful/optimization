---
title: Entry optimization and variant resolution
---

# Entry optimization and variant resolution

Use this document to understand how the Optimization SDK Suite resolves a Contentful baseline entry
to the entry variant selected for a visitor. It explains the runtime contract shared by the Core,
Web, React Web, React Native, Node, iOS, and Android SDKs. Because rendered entries can also contain
MergeTag entries, it also calls out where profile-dependent MergeTag value resolution differs from
entry replacement.

For installation and package setup, use the relevant integration guide. For state propagation before
resolution, see [Core state management](./core-state-management.md). For a broader explanation of
Contentful and SDK Experience/event locale handling, see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Resolution boundary](#resolution-boundary)
- [Runtime support](#runtime-support)
- [Inputs and constraints](#inputs-and-constraints)
- [Single-locale CDA entry contract](#single-locale-cda-entry-contract)
- [Data model](#data-model)
  - [Baseline entry](#baseline-entry)
  - [Optimization entry](#optimization-entry)
  - [Selected optimization](#selected-optimization)
  - [Merge tags and localized profile values](#merge-tags-and-localized-profile-values)
- [Resolution flow](#resolution-flow)
  - [Worked example](#worked-example)
  - [Variant indexing](#variant-indexing)
  - [Fallback behavior](#fallback-behavior)
  - [Multiple attached optimizations](#multiple-attached-optimizations)
- [Where resolution happens](#where-resolution-happens)
  - [Resolve directly with SDK methods](#resolve-directly-with-sdk-methods)
  - [Manage entry sources in custom adapters](#manage-entry-sources-in-custom-adapters)
  - [Render with framework components](#render-with-framework-components)
  - [Preview selected variants](#preview-selected-variants)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Resolution boundary

Entry variant resolution is a local, non-networked decision. The resolver does not fetch Contentful
entries, call the Experience API, evaluate audiences, allocate traffic, or mutate SDK state. It
receives:

- A baseline Contentful entry from the application layer.
- A `selectedOptimizations` array from SDK-normalized Experience API data or from state maintained
  by a stateful SDK.
- Linked optimization entries and variant entries already present in the Contentful payload.

The Experience API owns profile evaluation and returns the selected experience and variant metadata.
Contentful owns entry delivery and link resolution. The SDK joins those two data sets in memory and
returns either the baseline entry or a resolved variant entry.

Applications still own Contentful client configuration, locale choice, cache policy, consent,
identity, routing, and component rendering policy. JavaScript runtimes can either receive a manual
`baselineEntry` or call the app-provided `contentful.js` client through SDK-managed fetching. After
those inputs exist, entry resolution provides the content decision for the current profile or
request.

```text
Application provides a Contentful baseline entry or SDK fetches one by entry ID
  -> Application or SDK emits an Experience event
  -> SDK event result exposes data.selectedOptimizations
  -> SDK resolver matches selectedOptimizations to entry.fields.nt_experiences
  -> SDK returns baseline or linked variant entry for rendering
```

Raw Experience API responses name selected experiences in `data.experiences`. SDK event methods and
the API client normalize that field to `data.selectedOptimizations` before application code passes
it to entry resolution.

## Runtime support

Entry resolution is available across the Optimization SDK Suite, but the public surface depends on
the runtime:

| Runtime      | Direct API                                                                              | Component or native rendering API                            |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Core         | `resolveOptimizedEntry()` and managed `fetchOptimizedEntry()`                           | None                                                         |
| Web          | `resolveOptimizedEntry()` and managed `fetchOptimizedEntry()`                           | `ctfl-optimized-entry` Web Component                         |
| React Web    | `useEntryResolver()` and the underlying Web SDK method                                  | `useOptimizedEntry()` and `OptimizedEntry`                   |
| React Native | `useEntryResolver()`, `useOptimizedEntry()`, and the underlying React Native SDK method | `OptimizedEntry`                                             |
| Node         | `resolveOptimizedEntry()` and managed `fetchOptimizedEntry()`                           | None                                                         |
| iOS          | `OptimizationClient.resolveOptimizedEntry(baseline:selectedOptimizations:)`             | SwiftUI `OptimizedEntry`; UIKit can call the client directly |
| Android      | `suspend OptimizationClient.resolveOptimizedEntry(...)`                                 | Compose `OptimizedEntry`; XML Views `OptimizedEntryView`     |

For Next.js App Router integrations, prefer the app-local bound `OptimizedEntry` returned by
`bindNextjsAppRouterOptimization()` from `@contentful/optimization-nextjs/app-router`. In Server
Components it resolves through the Node SDK and server data; in Client Components the same app-local
name resolves through React Web. Pages Router integrations use
`bindNextjsPagesRouterOptimization()` from `@contentful/optimization-nextjs/pages-router` for
client rendering, and routes that resolve entries manually can call `getServerTrackingAttributes()`
or `ServerOptimizedEntry` when they need SSR tracking attributes. `ServerOptimizedEntry` accepts
either manual `baselineEntry` and `resolvedData` props or the result returned by managed
`fetchOptimizedEntry()`.

## Inputs and constraints

Usable entry selections depend on runtime state before the resolver runs:

- **Selected optimization source** - `selectedOptimizations` comes from accepted Experience API
  responses, configured defaults, or persisted defaults that a stateful runtime loads during
  startup. Blocked events do not produce fresh selection data.
- **Consent and allowed event types** - Event consent and `allowedEventTypes` decide which
  Experience events can emit before consent is accepted. If a page, screen, identify, track, or
  sticky view event is blocked, entry resolution uses the current in-memory selections, configured
  defaults, persisted selections, or `undefined`.
- **Persistence consent** - Durable profile-continuity loading, including persisted
  `selectedOptimizations`, happens only when persistence consent resolves to `true`. Configured
  defaults can still seed one runtime instance without enabling durable storage.
- **Offline and failed requests** - Accepted queued or offline events might not return data yet, and
  failed Experience requests do not publish newer selections. Stateful components can render from
  `undefined`, previous, or default selections until a successful response updates state.
- **Preview overrides** - Preview tooling mutates `selectedOptimizations` by applying audience or
  variant overrides. The resolver still receives an ordinary selection array and follows the same
  local matching rules.
- **Resolution boundary** - Synchronous entry resolution stays local and fail-soft. SDK-managed
  fetching is an additive JavaScript path that calls the configured `contentful.js` client before
  running the same resolver. Neither path retries Experience events, overrides consent policy, or
  throws for personalization misses.

## Single-locale CDA entry contract

The resolver expects standard single-locale Contentful Delivery API entry payloads. In that shape,
localized fields are direct field values, so optimization references are available as
`entry.fields.nt_experiences` and variant entries are available as
`optimizationEntry.fields.nt_variants`.

All-locale CDA payloads are incompatible with SDK entry resolution. `contentful.js` `withAllLocales`
and raw CDA `locale=*` return locale-keyed field maps instead of direct values, for example
`fields.nt_experiences['en-US']`. The SDK resolver intentionally handles one localized entry at a
time, so locale-keyed maps do not match the `OptimizedEntry` schema and resolution falls back to the
baseline entry.

JavaScript managed fetching is the preferred path when the application already owns a configured
`contentful.js` client. Configure the SDK with that client and a concrete single CDA locale:

JavaScript runtimes / TypeScript:

```ts
const appLocale = getAppLocale()

const optimization = new ContentfulOptimization({
  clientId,
  contentful: {
    client: contentfulClient,
    defaultQuery: { locale: appLocale },
  },
  environment,
  locale: appLocale,
})

const { baselineEntry, entry } = await optimization.fetchOptimizedEntry(entryId, {
  selectedOptimizations,
  query: {
    locale: appLocale,
  },
})
```

Manual `baselineEntry` fetching remains supported and unchanged. Fetch the entry with a single CDA
locale and enough include depth for optimization links:

```ts
const optimization = new ContentfulOptimization({
  clientId,
  environment,
  locale: appLocale,
})

const baselineEntry = await contentfulClient.getEntry(entryId, {
  include: 10,
  locale: appLocale,
})
```

Managed fetching merges `contentful.defaultQuery`, per-call query overrides, the SDK `locale`
fallback, and `include: 10`. Request-bound Node clients use `forRequest({ locale })` as the locale
fallback for managed Contentful entry fetching. Managed fetching also keeps a small per-SDK-instance
entry cache by default. Set `contentful.cache: false` when the host application must own all
Contentful entry caching.

Use an application-owned Contentful locale for manual CDA entry fetches that feed entry resolution.
The SDK top-level `locale` or Node `forRequest({ locale })` configures the SDK Experience/event
locale, but it does not modify manual Contentful client requests for you. For the full locale model,
see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

For entries that will be passed to the Optimization SDK resolver, use a concrete locale instead of
the CDA wildcard locale:

JavaScript runtimes / TypeScript:

```ts
// These patterns return all locales and produce locale-keyed fields.
await contentfulClient.withAllLocales.getEntry(entryId, { include: 10 })
await fetch(`/spaces/${space}/environments/${environment}/entries/${entryId}?include=10&locale=*`)
```

## Data model

### Baseline entry

A personalized entry starts as a regular Contentful entry with an `nt_experiences` field. That field
contains one or more linked `nt_experience` entries. The SDK treats the entry as optimized only when
`fields.nt_experiences` exists and the value conforms to the `OptimizedEntry` schema.

Resolved links matter. `nt_experiences` can contain Contentful links or full entries at the schema
level, but the resolver can match only full optimization entries. If Contentful returns unresolved
links, the resolver cannot inspect `nt_experience_id`, `nt_config`, or `nt_variants`, and resolution
falls back to the baseline entry. For optimized entries, request link depth sufficient to include
`nt_experiences`, their `nt_config`, and their `nt_variants`.

### Optimization entry

An optimization entry is a Contentful `nt_experience` entry attached to the baseline entry. It
contains the optimization metadata the resolver needs:

| Field              | Role in entry resolution                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `nt_experience_id` | Matches an item in `selectedOptimizations`.                                                                   |
| `nt_type`          | Identifies the entry as an experiment or personalization. The resolver treats both alike.                     |
| `nt_config`        | Defines entry-replacement components. Traffic, distribution, and stickiness are upstream allocation metadata. |
| `nt_variants`      | Contains the resolved Contentful entries that can replace the baseline entry.                                 |

Selected variant entries must use the same content type as the baseline entry. If a matched variant
ID points to a resolved entry with a different content type, the resolver ignores that entry and
falls back to the baseline entry.

Components with `type: "EntryReplacement"` participate in entry resolution. Components with omitted
`type` are also treated as `EntryReplacement` components for backward-compatible Contentful
payloads. `InlineVariable` components are resolved through the Custom Flag and `changes` flow, not
through `resolveOptimizedEntry()`.

### Selected optimization

`SelectedOptimization` is the Experience API selection record for an experience:

| Property       | Role in entry resolution                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| `experienceId` | Matches `optimizationEntry.fields.nt_experience_id`.                                     |
| `variantIndex` | Selects the baseline or one of the configured variants.                                  |
| `variants`     | Maps baseline entry IDs to variant entry IDs. The entry resolver does not read this map. |
| `sticky`       | Returned as metadata for matched selections and used by tracking surfaces.               |

The resolver uses `experienceId` and `variantIndex`. It returns the full `SelectedOptimization` as
metadata after it matches an attached optimization entry, including `variantIndex: 0` baseline
selections and variant fallback cases that happen after that match. It does not return selected
metadata when no selection exists, the entry is not optimized, or no selected experience matches an
attached optimization entry.

### Merge tags and localized profile values

Entry rendering can also involve MergeTag entries embedded in Rich Text. MergeTag helpers such as
`getMergeTagValue()` resolve against the current profile data returned by the Experience API. This
is separate from entry replacement: `resolveOptimizedEntry()` chooses the entry variant, while
MergeTag helpers resolve profile-dependent values inside rendered fields.

Stateful SDKs use their current SDK locale as the default Experience API locale and default event
context locale. Apps can change that value with `setLocale()` or, in React providers, by changing
the provider `locale` prop. Locale changes update SDK state only; fetch content or call `page()`,
`screen()`, or `identify()` again when the rendered data needs to refresh. Stateless server code
passes the application locale through `forRequest({ locale: appLocale })`.

That request locale is not a Contentful CDA locale. SDK top-level `locale`, stateful `setLocale()`,
and Node `forRequest({ locale })` normalize valid explicit locale values and reject invalid explicit
values before the request. When the SDK locale is omitted, the Experience API `locale` query
parameter is omitted and the API uses its own default. Advanced low-level Experience API client
locale options are passed through as query parameters; invalid values on that low-level path can
fail API validation before a profile response is returned. If the tag is valid but a specific
location translation is not available, localized location values can remain untranslated.

## Resolution flow

The shared Core resolver follows one path for every SDK package:

1. Return the baseline entry without selected metadata when `selectedOptimizations` is missing or
   empty.
2. Return the baseline entry without selected metadata when the input entry does not have an
   `nt_experiences` field in the expected shape.
3. Filter `entry.fields.nt_experiences` to fully resolved optimization entries.
4. Select the first optimization entry whose `nt_experience_id` appears in `selectedOptimizations`.
5. Return the baseline entry without selected metadata when no selected experience matches an
   attached optimization entry.
6. Find the matching `SelectedOptimization` for that optimization entry.
7. Treat `variantIndex: 0` as a baseline selection and return the baseline entry with
   `selectedOptimization` metadata.
8. Find the `EntryReplacement` component, including components with omitted `type`, whose
   `baseline.id` equals the baseline entry `sys.id` and whose baseline is not hidden.
9. Select the configured variant at `variantIndex - 1`.
10. When the selected variant has `id: ""` (empty string), return an **empty variant** outcome: the
    `isEmptyVariant` flag is set to `true` in `ResolvedData`, the baseline entry is returned as the
    entry field (for tracking context), and `selectedOptimization` metadata is preserved so a
    component view impression can still be emitted. No warning is logged. Renderers must suppress
    visible content when `isEmptyVariant` is `true`.
11. Find the linked Contentful variant entry in `optimizationEntry.fields.nt_variants` by the
    selected variant ID, and confirm that the variant entry uses the baseline entry content type.
12. Return the variant entry and `selectedOptimization` metadata when all checks pass.

If steps 8, 11, or 12 fail after a `SelectedOptimization` has matched (not caused by an empty
variant), the resolver returns the baseline entry with the matched `selectedOptimization` metadata.
Resolution returns entry objects from the Contentful payload. Applications can cache raw Contentful
payloads across requests, but profile-resolved entries are request-local or session-local decisions.

Running resolution only chooses which entry to render. Stateful packages listen for optimization
state changes around that decision, then choose again when their live-update rules allow it.

### Worked example

Assume the application fetched a baseline entry with `sys.id: "hero-baseline"`. The entry includes a
resolved `nt_experience` entry with `nt_experience_id: "exp-homepage-hero"` and an
`EntryReplacement` component:

```json
{
  "baseline": { "id": "hero-baseline" },
  "variants": [{ "id": "hero-variant-spring" }, { "id": "hero-variant-summer" }]
}
```

The same optimization entry includes `hero-variant-spring` and `hero-variant-summer` as resolved
entries in `nt_variants`. If the Experience API returns this selection:

```json
{
  "experienceId": "exp-homepage-hero",
  "variantIndex": 2,
  "variants": {
    "hero-baseline": "hero-variant-summer"
  },
  "sticky": true
}
```

resolution matches `experienceId` to `nt_experience_id`, finds the component whose `baseline.id` is
`hero-baseline`, reads the second configured variant because `variantIndex` is `2`, and returns the
resolved Contentful entry whose `sys.id` is `hero-variant-summer`.

### Variant indexing

`variantIndex` is baseline-aware:

| `variantIndex` value | Resolver behavior                                      |
| -------------------- | ------------------------------------------------------ |
| `0`                  | Return the baseline entry.                             |
| `1`                  | Use the first item in the component `variants` array.  |
| `2`                  | Use the second item in the component `variants` array. |
| Out of range         | Return the baseline entry.                             |

The index is not a JavaScript array index. The SDK interprets `0` as baseline and subtracts `1`
before reading from the configured variant array.

### Fallback behavior

Resolution is fail-soft. Invalid, incomplete, or unmatched data returns the baseline entry instead
of throwing. The selected metadata result distinguishes a baseline selection, an empty variant, and
a resolution miss:

| Condition                                         | Entry result   | `isEmptyVariant` | `selectedOptimization` result |
| ------------------------------------------------- | -------------- | ---------------- | ----------------------------- |
| No `selectedOptimizations`                        | Baseline entry | —                | `undefined`                   |
| Entry is not optimized                            | Baseline entry | —                | `undefined`                   |
| `nt_experiences` contains only unresolved links   | Baseline entry | —                | `undefined`                   |
| No selected experience matches an attached entry  | Baseline entry | —                | `undefined`                   |
| Selected `variantIndex` is `0`                    | Baseline entry | —                | Matched selection             |
| No relevant `EntryReplacement` component exists   | Baseline entry | —                | Matched selection             |
| Selected variant index is out of range            | Baseline entry | —                | Matched selection             |
| Selected variant has `id: ""` (empty variant)     | Baseline entry | `true`           | Matched selection             |
| Variant ID exists in config but not `nt_variants` | Baseline entry | —                | Matched selection             |
| Variant entry is still an unresolved link         | Baseline entry | —                | Matched selection             |
| Variant entry content type differs from baseline  | Baseline entry | —                | Matched selection             |

The "empty variant" row is distinct from data errors. When a content author selects the **Empty
variant** option in the Personalization UI, the variant is stored in `nt_config` as
`{ "id": "", "hidden": true }`. An unfilled placeholder slot (a variant added or unlinked but not
yet configured) is stored as `{ "id": "", "hidden": false }`. Both forms have `id: ""`, and both
produce `isEmptyVariant: true`.

The SDK detects an empty variant by `id === ""` — not by the `hidden` flag. The `hidden` flag is not
a reliable signal because the Experience API strips it before runtime; it only survives in the
Contentful CDA `nt_config` payload that the resolver reads. Using `id === ""` is stable across both
data sources.

When `isEmptyVariant` is `true`, renderers must not display any content. They must still emit a
component view impression so the empty variant is measurable in Insights. The baseline entry is
returned in the `entry` field as tracking context only.

Consumers must not rely on exceptions to detect personalization misses. Render the baseline entry
when no variant resolves; baseline fallback is expected behavior, not an error state.

### Multiple attached optimizations

A baseline entry can reference multiple `nt_experience` entries. The resolver picks the first
resolved optimization entry in `nt_experiences` whose `nt_experience_id` appears in
`selectedOptimizations`.

This makes Contentful link order meaningful when multiple selected experiences target the same
baseline entry. The resolver does not sort by optimization type, audience specificity, traffic, or
the order of `selectedOptimizations`.

`selectedOptimization.variants` remains part of the Experience API selection record, but the entry
resolver does not use that map to locate the replacement entry. Entry replacement comes from the
matched `nt_config` component and the resolved `nt_variants` entries in the Contentful payload.

## Where resolution happens

### Resolve directly with SDK methods

The shared method is `resolveOptimizedEntry(entry, selectedOptimizations?)`. It returns:

JavaScript runtimes / TypeScript:

```ts
{
  entry: Entry
  selectedOptimization?: SelectedOptimization
  optimizationContextId?: string
}
```

`optimizationContextId` is an opaque SDK-owned value. Stateful SDK methods register it when a
matched optimization produces interaction context, so entry view, click, hover, or tap tracking can
enrich follow-up events without recomputing the resolution context. It is optional because stateless
resolution and unmatched fallbacks do not register interaction context.

The Node SDK is stateless. Pass the request-local `selectedOptimizations` from the `data` returned
by `page()`, `identify()`, `screen()`, `track()`, or sticky `trackView()`.

Node server runtime / TypeScript:

```ts
const requestOptimization = optimization.forRequest({
  consent: true,
  profile,
})

const { accepted, data: optimizationData } = await requestOptimization.page({
  properties: { path: req.path },
})
const { entry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineEntry,
  accepted ? optimizationData?.selectedOptimizations : undefined,
)
```

For managed fetching, root stateless SDKs still need explicit selections for personalized results.
Request-bound `forRequest()` clients store the latest accepted Experience response and use its
`selectedOptimizations` when `fetchOptimizedEntry(entryId)` omits the option.

The Web, React Web, and React Native SDKs are stateful. If callers omit `selectedOptimizations`,
those SDKs resolve from their `selectedOptimizations` state. Passing an explicit array is still
useful for server-provided or request-local data because it avoids depending on ambient SDK state.

Provide optimization data before expecting optimized content. `page()`, `identify()`, `screen()`,
`track()`, and sticky `trackView()` can return the selected optimization data used by this method.

The iOS SDK exposes the same local boundary through
`OptimizationClient.resolveOptimizedEntry(baseline:selectedOptimizations:)`. UIKit apps usually pass
`client.selectedOptimizations` during cell or view configuration. The method returns a
`ResolvedOptimizedEntry` containing the resolved `entry` and optional `selectedOptimization`
metadata and `optimizationContextId`, and returns the baseline unchanged when no selected
optimization matches the entry.

The Android SDK exposes the same local, non-networked boundary through
`suspend OptimizationClient.resolveOptimizedEntry(baseline = ..., selectedOptimizations = ...)`.
Call it from a coroutine when resolving directly, or use Compose `OptimizedEntry` or XML Views
`OptimizedEntryView` so the adapter owns the coroutine call. Direct callers can pass
`client.selectedOptimizations.value`. The method returns a `ResolvedOptimizedEntry` containing the
resolved `entry` and optional `selectedOptimization` metadata and `optimizationContextId`, and
returns the baseline unchanged when no selected optimization matches the entry.

### Manage entry sources in custom adapters

`fetchOptimizedEntry(entryId)` is the one-shot JavaScript path for callers that can await a managed
Contentful fetch and immediate variant resolution. It returns the fetched `baselineEntry` plus the
resolved entry and optimization metadata.

`OptimizedEntrySourceController` from `@contentful/optimization-core/entry-source` is the adapter
primitive for mounted components, hooks, custom elements, or other runtime wrappers that accept
either `baselineEntry` or `entryId`. It manages source changes, SDK readiness, loading and error
snapshots, stale fetch protection, and disconnect cleanup before resolution. It does not resolve or
render entries. After a snapshot contains `baselineEntry`, the adapter still calls
`resolveOptimizedEntry()`, renders the result, and attaches any tracking metadata for its runtime.

### Render with framework components

Use framework components or native view adapters when rendering is already inside a supported
framework tree or native view adapter. These surfaces subscribe to SDK state, call the same shared
resolver, and pass the resolved entry to your rendering code.

The Web SDK `ctfl-optimized-entry` custom element uses the same `OptimizedEntryController` as the
framework adapters. Assign the structured Contentful entry through the `baselineEntry` property, or
configure the SDK with `contentful: { client }` and set `entry-id`/`entryId` plus optional
`entryQuery`. `baselineEntry` takes precedence when both are set. Provide an SDK through either an
ancestor or explicit `ctfl-optimization-root` binding or the element's `sdk` property. The element
honors `live-updates`, `track-clicks`, `track-hovers`, and `track-views` attributes, applies
`data-ctfl-*` tracking attributes to the host, and emits `ctfl-entry-loading`,
`ctfl-entry-resolved`, and `ctfl-entry-error` events as entry fetching and controller state changes.
The Web SDK README owns setup details for defining the custom elements and assigning property-only
values.

React Web wraps resolution in `useOptimizedEntry()` and `OptimizedEntry`. `OptimizedEntry`:

- Subscribes to `sdk.states.selectedOptimizations`.
- Accepts either `baselineEntry` or managed `entryId` with optional `entryQuery`.
- Locks to the first non-`undefined` selected optimization set by default.
- Re-resolves when `liveUpdates` is enabled globally, per component, or by the preview panel.
- Shows a loading fallback for optimized entries until optimization state is available.
- Renders static children unchanged or calls a render prop with the resolved entry.
- Adds `data-ctfl-*` attributes that the Web SDK entry tracking runtime can observe.
- Blocks nested `OptimizedEntry` components that use the same baseline entry ID to prevent duplicate
  rendered branches.

React Web also exposes `useEntryResolver()` for components that need manual resolution without the
`OptimizedEntry` wrapper.

React Native wraps resolution in `useOptimizedEntry()` and `OptimizedEntry`. `OptimizedEntry`:

- Passes non-optimized entries through unchanged.
- Accepts either `baselineEntry` or managed `entryId` with optional `entryQuery`.
- Renders `loadingFallback` or `null` while a managed entry is fetching.
- Renders `errorFallback` or `null` and calls `onEntryError` when managed entry fetching fails.
- Subscribes to `states.selectedOptimizations` only for optimized entries.
- Locks to the first selected optimization set by default.
- Re-resolves when `liveUpdates` is enabled globally, per component, or by the preview panel.
- Renders static children unchanged or calls a render prop with the resolved entry.
- Sends view and tap tracking metadata from the resolved entry and `selectedOptimization`.

React Native does not render DOM data attributes. It passes the resolved entry and optimization
metadata directly into its viewport and tap tracking hooks after a real entry exists.
`useEntryResolver()` remains the manual-only helper when a component already owns its baseline
entry.

SwiftUI uses the same resolver inside `OptimizedEntry`. The component passes non-optimized entries
through unchanged, resolves optimized entries from the client's selected optimizations, can lock to
the first resolved variant, can re-resolve when live updates are enabled, and can attach iOS view
and tap tracking using the baseline entry identity with `selectedOptimization` and
`optimizationContextId` metadata.

Android Compose uses the same resolver inside `OptimizedEntry`, and Android XML Views use it inside
`OptimizedEntryView`. Both adapters pass non-optimized entries through unchanged, resolve optimized
entries from the client's selected optimizations, can lock to the first resolved variant, can
re-resolve when live updates are enabled, and can attach Android view and tap tracking using the
baseline entry identity with `selectedOptimization` and `optimizationContextId` metadata.

### Preview selected variants

Preview tooling changes selected variants by overriding `variantIndex` in `selectedOptimizations`.
The override path does not rewrite Contentful entries. After an override is merged into the selected
optimization signal, normal entry resolution runs again and picks the variant at the overridden
index.

Because the resolver uses `variantIndex`, preview overrides can append synthetic selected
optimization records with an empty `variants` map. This works as long as the matching
`nt_experience` entry and variant entries are present in the Contentful payload.

## Related documentation

Use these concept docs for mechanics that often affect entry resolution:

- [Core state management](./core-state-management.md) explains state propagation before stateful
  runtimes resolve entries.
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md)
  explains event and persistence consent gates.
- [Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md)
  explains the difference between Contentful CDA locales and SDK Experience/event locales.
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
  explains how Node and browser runtimes share `profile`, `selectedOptimizations`, and `changes`.
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md),
  [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md),
  [React Native SDK interaction tracking mechanics](./react-native-sdk-interaction-tracking-mechanics.md),
  [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md), and
  [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md)
  explain how resolved entry metadata is used for tracking.

Use these guides for SDK-specific integration paths:

- [Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the Optimization React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md)
- [Integrating the Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md)
- [Building a custom JavaScript Optimization adapter](../guides/building-a-custom-javascript-optimization-adapter.md)
- [Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
- [Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md)
- [Integrating the Optimization Android SDK in a Jetpack Compose app](../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md)
- [Integrating the Optimization Android SDK in an XML Views app](../guides/integrating-the-optimization-android-sdk-in-a-views-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js App Router app](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js Pages Router app](../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)

Use these package READMEs when you need runtime-specific API orientation:

- [Optimization Core SDK](../../packages/universal/core-sdk/README.md)
- [Optimization Web SDK](../../packages/web/web-sdk/README.md)
- [Optimization React Web SDK](../../packages/web/frameworks/react-web-sdk/README.md)
- [Optimization Next.js SDK](../../packages/web/frameworks/nextjs-sdk/README.md)
- [Optimization React Native SDK](../../packages/react-native-sdk/README.md)
- [Optimization Node SDK](../../packages/node/node-sdk/README.md)
- [Optimization iOS SDK](../../packages/ios/ContentfulOptimization/README.md)
- [Optimization Android SDK](../../packages/android/README.md)
