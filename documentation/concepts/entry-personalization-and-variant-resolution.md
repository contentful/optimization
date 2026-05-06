---
title: Entry personalization and variant resolution
---

# Entry personalization and variant resolution

Use this document to understand how the Optimization SDK Suite resolves a Contentful baseline entry
to the entry variant selected for a visitor. It explains the runtime contract shared by the Core,
Web, React Web, React Native, and Node SDKs.

For installation and package setup, use the relevant integration guide. For state propagation before
resolution, see [Core state management](./core-state-management.md).

<details>
  <summary>Table of Contents</summary>

- [Resolution boundary](#resolution-boundary)
- [Data model](#data-model)
  - [Baseline entry](#baseline-entry)
  - [Optimization entry](#optimization-entry)
  - [Selected optimization](#selected-optimization)
- [Resolution flow](#resolution-flow)
  - [Worked example](#worked-example)
  - [Variant indexing](#variant-indexing)
  - [Fallback behavior](#fallback-behavior)
  - [Multiple attached optimizations](#multiple-attached-optimizations)
- [Where resolution happens](#where-resolution-happens)
  - [Resolve directly with SDK methods](#resolve-directly-with-sdk-methods)
  - [Render with framework components](#render-with-framework-components)
  - [Preview selected variants](#preview-selected-variants)

</details>

## Resolution boundary

Entry variant resolution is a local, synchronous decision. The resolver does not fetch Contentful
entries, call the Experience API, evaluate audiences, allocate traffic, or mutate SDK state. It
receives:

- A baseline Contentful entry from the application layer.
- A `selectedOptimizations` array from the Experience API or from state maintained by a stateful
  SDK.
- Linked optimization entries and variant entries already present in the Contentful payload.

The Experience API owns profile evaluation and returns the selected experience and variant metadata.
Contentful owns entry delivery and link resolution. The SDK joins those two data sets in memory and
returns either the baseline entry or a resolved variant entry.

Applications still own consent, identity, routing, Contentful fetching, and component rendering
policy. After those inputs exist, entry resolution provides the content decision for the current
profile or request.

```text
Application fetches Contentful baseline entry
  -> Application or SDK emits an Experience event
  -> Experience API returns selectedOptimizations
  -> SDK resolver matches selectedOptimizations to entry.fields.nt_experiences
  -> SDK returns baseline or linked variant entry for rendering
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

Only `EntryReplacement` components participate in entry resolution. `InlineVariable` components are
resolved through the Custom Flag and `changes` flow, not through `resolveOptimizedEntry()`.

### Selected optimization

`SelectedOptimization` is the Experience API selection record for an experience:

| Property       | Role in entry resolution                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| `experienceId` | Matches `optimizationEntry.fields.nt_experience_id`.                                     |
| `variantIndex` | Selects the baseline or one of the configured variants.                                  |
| `variants`     | Maps baseline entry IDs to variant entry IDs. The entry resolver does not read this map. |
| `sticky`       | Returned as metadata on successful variant resolution and used by tracking surfaces.     |

The resolver uses `experienceId` and `variantIndex`. It returns the full `SelectedOptimization` as
metadata only when it resolves to a non-baseline variant.

## Resolution flow

The shared Core resolver follows one path for every SDK package:

1. Return the baseline entry when `selectedOptimizations` is missing or empty.
2. Return the baseline entry when the input entry does not have an `nt_experiences` field in the
   expected shape.
3. Filter `entry.fields.nt_experiences` to fully resolved optimization entries.
4. Select the first optimization entry whose `nt_experience_id` appears in `selectedOptimizations`.
5. Find the matching `SelectedOptimization` for that optimization entry.
6. Treat `variantIndex: 0` or a missing selection as baseline.
7. Find the `EntryReplacement` component whose `baseline.id` equals the baseline entry `sys.id` and
   whose baseline is not hidden.
8. Select the configured variant at `variantIndex - 1`.
9. Find the linked Contentful variant entry in `optimizationEntry.fields.nt_variants` by the
   selected variant ID.
10. Return the variant entry and `selectedOptimization` metadata when all checks pass.

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
of throwing.

| Condition                                         | Result         |
| ------------------------------------------------- | -------------- |
| No `selectedOptimizations`                        | Baseline entry |
| Entry is not optimized                            | Baseline entry |
| `nt_experiences` contains only unresolved links   | Baseline entry |
| No selected experience matches an attached entry  | Baseline entry |
| Selected `variantIndex` is `0`                    | Baseline entry |
| No relevant `EntryReplacement` component exists   | Baseline entry |
| Selected variant index is out of range            | Baseline entry |
| Variant ID exists in config but not `nt_variants` | Baseline entry |
| Variant entry is still an unresolved link         | Baseline entry |

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

```ts
{
  entry: Entry
  selectedOptimization?: SelectedOptimization
}
```

The Node SDK is stateless. Pass the request-local `selectedOptimizations` returned by `page()`,
`identify()`, `screen()`, `track()`, or sticky `trackView()`.

```ts
const optimizationData = await optimization.page({ profile, properties: { path: req.path } })
const { entry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineEntry,
  optimizationData?.selectedOptimizations,
)
```

The Web and React Native SDKs are stateful. If callers omit `selectedOptimizations`, those SDKs
resolve from their `selectedOptimizations` state. Passing an explicit array is still useful for
server-provided or request-local data because it avoids depending on ambient SDK state.

Provide optimization data before expecting personalized content. `page()`, `identify()`, `screen()`,
`track()`, and sticky `trackView()` can return the selected optimization data used by this method.

### Render with framework components

Use framework components when rendering is already inside a supported React tree. They subscribe to
SDK state, call the same shared resolver, and pass the resolved entry to your rendering code.

React Web wraps resolution in `useOptimizedEntry()` and `OptimizedEntry`. `OptimizedEntry`:

- Subscribes to `sdk.states.selectedOptimizations`.
- Locks to the first non-`undefined` selected optimization set by default.
- Re-resolves when `liveUpdates` is enabled globally, per component, or by the preview panel.
- Shows a loading fallback for optimized entries until optimization state is available.
- Renders static children unchanged or calls a render prop with the resolved entry.
- Adds `data-ctfl-*` attributes that the Web SDK entry tracking runtime can observe.
- Blocks nested `OptimizedEntry` components that use the same baseline entry ID to prevent duplicate
  rendered branches.

React Web also exposes `useOptimization().resolveEntry()` and `useOptimization().resolveEntryData()`
for components that need manual resolution without the `OptimizedEntry` wrapper.

React Native uses the same resolver inside its `OptimizedEntry` component. The component:

- Passes non-optimized entries through unchanged.
- Subscribes to `states.selectedOptimizations` only for optimized entries.
- Locks to the first selected optimization set by default.
- Re-resolves when `liveUpdates` is enabled globally, per component, or by the preview panel.
- Passes the resolved entry to render-prop children.
- Sends view and tap tracking metadata from the resolved entry and `selectedOptimization`.

React Native does not render DOM data attributes. It passes the resolved entry and optimization
metadata directly into its viewport and tap tracking hooks.

### Preview selected variants

Preview tooling changes selected variants by overriding `variantIndex` in `selectedOptimizations`.
The override path does not rewrite Contentful entries. After an override is merged into the selected
optimization signal, normal entry resolution runs again and picks the variant at the overridden
index.

Because the resolver uses `variantIndex`, preview overrides can append synthetic selected
optimization records with an empty `variants` map. This works as long as the matching
`nt_experience` entry and variant entries are present in the Contentful payload.
