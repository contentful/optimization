# Preview support (internal)

> [!CAUTION]
>
> **This module is not part of the public Core SDK surface and is not intended for direct use by
> applications or third-party SDKs.** It exists solely to support the first-party Contentful preview
> panel across platforms (web, React Native, iOS). It lives inside `@contentful/optimization-core`
> because the override state machine is core to that cross-platform preview functionality and must
> sit alongside the SDK's internal signals and interceptors. Treat everything documented here as
> internal plumbing: APIs, types, and behaviors may change without notice and without a SemVer major
> bump. If you are building an application on the Optimization SDKs, use the platform SDK's preview
> panel component, not these primitives.

The `@contentful/optimization-core/preview-support` entry point ships the cross-platform
preview-panel toolkit: the override state machine, the preview view-model builder, the Contentful
content-model entry mappers, and the Contentful fetch helpers. It is consumed by
`@contentful/optimization-react-native` (re-exported as its own `./preview-support` entry point) and
`@contentful/optimization-ios-bridge`, and is reserved for future first-party SDKs that surface a
Contentful-backed preview panel.

This entry only contains the shared toolkit. Platform-specific preview UI (the React Native
`PreviewPanel` component, the matching hooks, the iOS Swift glue, the future web preview panel)
remains in the respective SDKs.

```ts
import {
  PreviewOverrideManager,
  buildPreviewModel,
  createAudienceDefinitions,
  createExperienceDefinitions,
  fetchAudienceAndExperienceEntries,
} from '@contentful/optimization-core/preview-support'
```

The toolkit pairs with the [`registerPreviewPanel`](#registerpreviewpanel) bridge below: hosts call
`registerPreviewPanel` with a plain object, pull the SDK signals out via
`PREVIEW_PANEL_SIGNALS_SYMBOL`, and pass them into the toolkit.

## `registerPreviewPanel`

`CoreStateful` exposes `registerPreviewPanel(previewPanel)` to wire a preview consumer into the
SDK's internal signals. This is the only sanctioned way for the first-party preview tooling to read
and mutate optimization state without going through the network.

Arguments:

- `previewPanel`: Required object that receives symbol-keyed signal bridge values

Returns:

- `void`

Bridge symbols:

- `PREVIEW_PANEL_SIGNALS_SYMBOL`: key used to expose internal `signals`
- `PREVIEW_PANEL_SIGNAL_FNS_SYMBOL`: key used to expose internal `signalFns`

Example:

```ts
import {
  PREVIEW_PANEL_SIGNAL_FNS_SYMBOL,
  PREVIEW_PANEL_SIGNALS_SYMBOL,
  type PreviewPanelSignalObject,
} from '@contentful/optimization-core'

const previewBridge: PreviewPanelSignalObject = {}
optimization.registerPreviewPanel(previewBridge)

const signals = previewBridge[PREVIEW_PANEL_SIGNALS_SYMBOL]
const signalFns = previewBridge[PREVIEW_PANEL_SIGNAL_FNS_SYMBOL]
```

> [!IMPORTANT]
>
> This method intentionally exposes mutable internal signals for preview tooling. The Web and React
> Native preview panels are tightly coupled by design and rely on this bridge (plus state
> interceptors) to apply immediate local overrides without network round-trips. This coupling is
> deliberate and necessary for preview functionality, and is not a general-purpose extension point.

## `PreviewOverrideManager`

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

The constructor takes core's `InterceptorManager<OptimizationData>` directly (typically
`optimization.interceptors.state`).

## `applyOptimizationOverrides`

Pure function that merges an override map into a `SelectedOptimizationArray`. Used internally by
`PreviewOverrideManager` whenever it needs to rewrite the signal from baseline. Exported for hosts
that want the same merge semantics outside the manager.

## `buildPreviewModel`

Pure function that takes audience definitions, experience definitions, a snapshot of SDK signals
(`PreviewSdkSignals`), and the current `OverrideState`, and returns the `PreviewModel` DTO the UI
renders. It groups experiences under their audiences (adding an implicit "All Visitors" bucket for
unattached experiences), enriches each experience with its current variant index, `isOverridden`,
and the pre-override `naturalVariantIndex` when a baseline snapshot is supplied, and sorts the
result deterministically (All Visitors first, then qualified audiences, then alphabetical by name).

## Entry mappers

Translate Contentful entries into the shapes the panel understands:

- `createAudienceDefinitions(entries)` — `nt_audience` entries → `AudienceDefinition[]`.
- `createExperienceDefinitions(entries)` — `nt_experience` entries → `ExperienceDefinition[]`,
  including variant distribution percentages and variant display names sourced from linked entries.
- `createExperienceNameMap(entries)` — convenience lookup map from experience/personalization ID to
  the human-readable `nt_name`.

These mappers encode the Optimization platform's Contentful content-model schema. The rest of core
remains free of Contentful schema knowledge.

## Contentful fetch helpers

`contentfulFetch.ts` wraps a minimal `ContentfulClient` interface (just `getEntries`) with
pagination handling:

- `fetchAllEntriesByContentType(client, contentType, include?)` — fetches all entries of a single
  content type, batching in pages of 100.
- `fetchAudienceAndExperienceEntries(client)` — parallel fetch of `nt_audience` and `nt_experience`
  entries in one call.

The package does not depend on the `contentful` SDK directly, so consumers can pass any compatible
client.

## Types and constants

- `AudienceDefinition`, `ExperienceDefinition`, `VariantDistribution` — platform-neutral shapes
  produced by the entry mappers.
- `ExperienceWithState`, `AudienceWithExperiences`, `PreviewData`, `PreviewModel` — enriched shapes
  produced by `buildPreviewModel`.
- `AudienceOverride`, `OptimizationOverride`, `OverrideState`, `AudienceOverrideState` — override
  state shapes owned by `PreviewOverrideManager`.
- `PreviewSdkSignals` — the subset of SDK signals `buildPreviewModel` reads. A plain snapshot type,
  not a live signal, so hosts decide how to sample and when to re-render.
- `ContentfulClient`, `ContentfulEntry`, `ContentfulEntryCollection` — the minimal Contentful
  surface the fetch helpers and entry mappers operate on.
- `ALL_VISITORS_AUDIENCE_ID`, `ALL_VISITORS_AUDIENCE_NAME`, `ALL_VISITORS_AUDIENCE_DESCRIPTION` —
  identifiers for the synthetic "All Visitors" bucket `buildPreviewModel` adds for experiences with
  no audience target.
