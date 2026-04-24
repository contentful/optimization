# Contentful Optimization Preview SDK

### Cross-platform preview-panel toolkit

[Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Optimization Preview SDK is the platform-agnostic toolkit that powers the preview/debug panels
shipped with the Web, React Native, and iOS SDKs. It owns the override state machine, the audience
and experience view-model builder, and the Contentful content-model mappers — everything the panels
render but nothing that is tied to a specific platform's UI.

Table of Contents

- [How It Works](#how-it-works)
  - [Attachment Bridge (in `@contentful/optimization-core`)](#attachment-bridge-in-contentfuloptimization-core)
  - [Override Lifecycle](#override-lifecycle)
  - [Render Lifecycle](#render-lifecycle)
- [Package Contents](#package-contents)
  - `[PreviewOverrideManager](#previewoverridemanager)`
  - `[applyOptimizationOverrides](#applyoptimizationoverrides)`
  - `[buildPreviewModel](#buildpreviewmodel)`
  - [Entry Mappers](#entry-mappers)
  - [Contentful Fetch Helpers](#contentful-fetch-helpers)
  - [Types](#types)
  - [Constants](#constants)
- [Consumers](#consumers)

## How It Works

### Attachment Bridge (in `@contentful/optimization-core`)

`CoreStateful` exposes an attachment point the preview toolkit uses to read live SDK state:

- `previewPanelAttached`, `previewPanelOpen` — signals that reflect panel lifecycle.
- `PREVIEW_PANEL_SIGNALS_SYMBOL`, `PREVIEW_PANEL_SIGNAL_FNS_SYMBOL` — well-known symbols keyed on
  the object handed to `registerPreviewPanel`.
- `CoreStateful.registerPreviewPanel(obj)` — stamps the shared `Signals` and `SignalFns` references
  onto `obj` via those symbols.

Preview consumers call `registerPreviewPanel` with a plain object, then pull the signals out with
`Reflect.get(obj, PREVIEW_PANEL_SIGNALS_SYMBOL)` and pass them to this package.

### Override Lifecycle

1. The host creates a `PreviewOverrideManager`, wiring in the SDK's `selectedOptimizations` (and
   optionally `profile`) signals, the stateful core's `interceptors.state` registry, and an
   `onOverridesChanged` callback.
2. The manager registers a **state interceptor** on core. Every time an API refresh produces new
   `OptimizationData`, the interceptor:

- Caches the fresh `selectedOptimizations` as the new baseline.
- Re-applies any active overrides on top, using `applyOptimizationOverrides`.
- Invokes `onOverridesChanged` so the host (React component, iOS native callback, etc.) can
  re-render.

3. Host UI calls `manager.activateAudience(...)`, `deactivateAudience(...)`,
   `setVariantOverride(...)`, `resetAudienceOverride(...)`, `resetOptimizationOverride(...)`, or
   `resetAll()`. Each mutation derives the next signal value from the cached **baseline**, never
   from the (possibly already-overridden) current signal — so overrides never compound.
4. On teardown, `manager.destroy()` removes the interceptor and clears internal state.

### Render Lifecycle

`buildPreviewModel` produces a single DTO the UI can render directly:

- Groups `ExperienceDefinition`s under their `AudienceDefinition`s.
- Adds an implicit "All Visitors" bucket for experiences that target no audience (or target one not
  supplied in `audienceDefinitions`).
- Enriches each experience with its current variant index, `isOverridden`, and the pre-override
  `naturalVariantIndex` when a baseline snapshot is supplied.
- Sorts deterministically: All-Visitors first, then qualified audiences, then alphabetical by name.

The same DTO shape is consumed by the React Native hooks and the iOS bridge (which JSON-encodes it
for Swift).

## Package Contents

### `PreviewOverrideManager`

Platform-agnostic override state machine. Registers a state interceptor on core so overrides survive
API refreshes, and exposes mutation methods for the preview UI:

- `activateAudience(audienceId, experienceIds)` — forces an audience active and sets its member
  experiences to variant index 1.
- `deactivateAudience(audienceId, experienceIds)` — forces an audience inactive and resets member
  experiences to variant index 0.
- `setVariantOverride(experienceId, variantIndex)` — per-experience variant override.
- `resetAudienceOverride(audienceId)` — clears one audience plus its associated experience
  overrides.
- `resetOptimizationOverride(experienceId)` — clears a single experience override.
- `resetAll()` — clears everything and restores the baseline.
- `getOverrides()`, `getBaselineSelectedOptimizations()`, `getBaselineAudienceQualifications()` —
  read-only accessors for the UI.
- `destroy()` — removes the interceptor and clears internal state.

The constructor takes a `StateInterceptorRegistry<OptimizationData>`, a structural type — the
manager does not import the concrete `InterceptorManager` class from core, which avoids nominal type
mismatches when core is resolved from multiple paths in a monorepo.

### `applyOptimizationOverrides`

Pure function that merges an override map into a `SelectedOptimizationArray`. Used internally by
`PreviewOverrideManager` whenever it needs to rewrite the signal from baseline. Exported for hosts
(or other preview surfaces) that want the same merge semantics.

### `buildPreviewModel`

Pure function that takes audience definitions, experience definitions, a snapshot of SDK signals
(`PreviewSdkSignals`), and the current `OverrideState`, and returns the `PreviewModel` DTO the UI
renders. Optionally accepts a baseline `SelectedOptimizationArray` so overridden experiences can
expose their pre-override `naturalVariantIndex`.

### Entry Mappers

Translate Contentful entries into the shapes the panel understands. All live in `entryMappers.ts`:

- `createAudienceDefinitions(entries)` — `nt_audience` entries → `AudienceDefinition[]`.
- `createExperienceDefinitions(entries)` — `nt_experience` entries → `ExperienceDefinition[]`,
  including variant distribution percentages and variant display names sourced from linked entries.
- `createExperienceNameMap(entries)` — convenience lookup map from experience/personalization ID to
  the human-readable `nt_name`.

These mappers encode the Optimization platform's Contentful content-model schema and are the reason
this logic does not belong in core.

### Contentful Fetch Helpers

`contentfulFetch.ts` wraps the `ContentfulClient` interface with pagination handling:

- `fetchAllEntriesByContentType(client, contentType, include?)` — fetches all entries of a single
  content type, batching in pages of 100.
- `fetchAudienceAndExperienceEntries(client)` — parallel fetch of `nt_audience` and `nt_experience`
  entries in one call.

`ContentfulClient` is a minimal structural interface (just `getEntries`) — the package does not
depend on the `contentful` SDK directly, so consumers can pass any compatible client.

### Types

Exported from `definitions.ts`, `types.ts`, and `signals.ts`:

- `AudienceDefinition`, `ExperienceDefinition`, `VariantDistribution` — the platform-neutral shapes
  produced by the entry mappers.
- `ExperienceWithState`, `AudienceWithExperiences`, `PreviewData`, `PreviewModel` — the enriched
  shapes produced by `buildPreviewModel`.
- `AudienceOverride`, `OptimizationOverride`, `OverrideState`, `AudienceOverrideState` — override
  state shapes owned by `PreviewOverrideManager`.
- `PreviewSdkSignals` — the subset of SDK signals `buildPreviewModel` reads. A plain snapshot type,
  not a live signal, so hosts decide how to sample and when to re-render.
- `ContentfulClient`, `ContentfulEntry`, `ContentfulEntryCollection` — the minimal Contentful
  surface the fetch helpers and entry mappers operate on.

### Constants

- `ALL_VISITORS_AUDIENCE_ID`, `ALL_VISITORS_AUDIENCE_NAME`, `ALL_VISITORS_AUDIENCE_DESCRIPTION` —
  identifiers for the synthetic "All Visitors" bucket `buildPreviewModel` adds for experiences with
  no audience target.

## Consumers

- `**@contentful/optimization-ios-bridge`\*\* — the JavaScript side of the iOS SDK's JSC bridge.
  Owns a `PreviewOverrideManager`, calls `buildPreviewModel` inside `getPreviewState()`, and
  serializes the DTO to JSON for Swift.
- `**@contentful/optimization-react-native`\*\* — `useProfileOverrides` wraps a
  `PreviewOverrideManager`; `usePreviewData` is a `useMemo` wrapper around `buildPreviewModel`.
  Entry mappers and fetch helpers are re-exported through the RN preview surface.
- `**@contentful/optimization-web-preview-panel**` _(planned)_ — currently ships its own override
  merge implementation; migrating it to consume `PreviewOverrideManager` and `buildPreviewModel`
  from this package is the intended next step, at which point all three platforms will share the
  same preview core.
