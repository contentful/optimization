---
sdk: android-views
archetype: integration
kb: ../../internal/sdk-knowledge/native/android.md
guide: ../../guides/integrating-the-optimization-android-sdk-in-a-views-app.md
---

# Android XML Views guide blueprint

## Quick-start contract

- **Outcome:** The SDK initializes from the application and one accepted screen event is emitted from
  a visible activity.
- **Verification:** With `logLevel = debug`, run on a device/emulator and find the accepted screen
  event in logcat by a named tag/token; a diagnostic explains a blocked outcome.
- **Reader shape:** An `Application` subclass and one `Activity`.
- **Required artifacts:** Maven Central dependency; an `Application` diff that initializes one
  manager plus the `AndroidManifest.xml` `android:name` registration; an activity that tracks the
  current screen in `onResume`; a `logLevel` diagnostic; verification.
- **Deliberate simplifications:** Consent starts granted; entry rendering is deferred to Core because
  the app must supply the Contentful fetch.
- **Explainer switches:** profile point = include; managed-fetch clause = omit.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding),
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).

## Milestone contract

- **Milestone 1:** The SDK initialized from the application and one accepted screen event (the quick
  start), plus entries resolving through `OptimizedEntryView`/`resolveOptimizedEntry` once the app
  passes fetched Contentful entries (the Core entry section).
- **Milestone 2:** Policy-dependent and optional layers — consent handoff, interaction tracking,
  identity, Custom Flags, live updates, preview, and offline delivery.
- **Boundary:** Mandatory application/activity wiring plus the first accepted event and entry render
  versus opt-in application policy and capabilities.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding),
  [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks).

## Section map

| Section                                                      | Category                       | Purpose                                                               | Must teach or show                                                                                                                    | Fact sources                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK installation and process-wide client                     | Required for first integration | Establish the package and the app-scoped `OptimizationManager`.       | Maven Central dependency; `Application` init diff plus manifest registration; readiness await; required versus defaulted config keys. | [setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding), [package](../../internal/sdk-knowledge/native/android.md#package--entry-points) |
| Consent and privacy-policy handoff                           | Common but policy-dependent    | Replace the quick-start default-on shortcut and explain the two axes. | Two-axis example; boolean versus split consent; pre-consent allow-list; app-owned policy.                                             | [consent](../../internal/sdk-knowledge/native/android.md#consent--persistence)                                                                                             |
| Contentful fetching and entry resolution                     | Required for first integration | Establish the app-owned fetch and the view-based resolver.            | App owns the CDA fetch (no managed path); single-locale and include depth; `OptimizedEntryView` renderer; baseline fallback.          | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [fallback](../../internal/sdk-knowledge/native/android.md#failure--fallback-behavior)   |
| Screen and navigation tracking                               | Required for first integration | Deepen the quick-start screen proof across activity navigation.       | `ScreenTracker.trackScreen` from `onResume`; route-key dedupe; `screen` versus `trackCurrentScreen` choice.                           | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                                  |
| Entry interaction tracking                                   | Common but policy-dependent    | Explain view- and tap-tracking and list integration.                  | `OptimizedEntryView` view/tap tracking; `TrackingRecyclerView` for lists; opt-outs; duplicate prevention.                             | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                                  |
| Identity, profile continuity, and reset                      | Common but policy-dependent    | Integrate login/logout and profile continuity.                        | Identify/reset example; `SharedPreferences` continuity; reset preserves consent.                                                      | [consent](../../internal/sdk-knowledge/native/android.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/native/android.md#identifier-ownership)         |
| Custom events and analytics diagnostics                      | Optional                       | Cover business events and the debug/forwarding seam.                  | `track` example; `SharedFlow` `eventStream` replay-buffer semantics; `blockedEventStream`; forwarding link.                           | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                                  |
| Custom Flags and MergeTag rendering                          | Optional                       | Cover content-model-dependent reads.                                  | `getFlag` versus `observeFlag` `StateFlow`; `getMergeTagValue`; flag-view exposure governance.                                        | [events](../../internal/sdk-knowledge/native/android.md#events--tracking), [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution)               |
| Live updates and locked variants                             | Optional                       | Let Views apps choose live or locked content.                         | Locked snapshot versus live subscription; `null` versus explicit selections; preview forces redraw.                                   | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)       |
| Preview panel                                                | Optional                       | Add the Views debug/authoring surface.                                | Debug gating; `OptimizationManager.attachPreviewPanel`; `PreviewContentfulClient` for names; same client.                             | [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)                                                                                          |
| Offline delivery, queue observability, and app-owned caching | Advanced or production-only    | Expose production delivery posture and the app cache boundary.        | Default offline path; queue policy and callbacks; in-memory 100-event cap; app-owned content caching.                                 | [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks), [events](../../internal/sdk-knowledge/native/android.md#events--tracking)               |

## SDK-specific authoring overrides

- Omit the personalization-explainer managed-fetch clause: the Android SDK has no fetch-by-ID path,
  so the app always owns the Contentful fetch. Facts:
  [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution).
- Prove "init plus one accepted screen event" in the quick start, with a distinguishable success
  signal and a failure diagnostic — do not use an unfalsifiable "renders baseline or variant" check.
  Entry rendering moves to Core because Android has no managed fetch. Facts:
  [setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding),
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).
- Show the `Application` runtime root as a `+`/`-` diff and include the `AndroidManifest.xml`
  `android:name` registration inline: without it `onCreate` never runs and the SDK never initializes.
  Facts: [setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding).
- Split screen tracking from custom events into distinct sections with distinct categories (screen is
  Required/Core; custom events are Optional); do not bundle them under one section. Facts:
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).
- Use screen/tap/viewport vocabulary throughout; never import hover vocabulary from web, and do not
  put `page` in pre-consent blocked-event lists unless the guide first teaches `client.page`. Facts:
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).
- Note that `eventStream`/`blockedEventStream` are replay-buffered `SharedFlow`s (late subscribers
  receive recent events), unlike the iOS passthrough streams. Facts:
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).

## Troubleshooting scope

| Reader symptom                            | Why it belongs                                                   | Fact sources                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK never initializes / events never emit | Missing manifest `android:name` registration or readiness await. | [setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding)                                                                             |
| Entries always render the baseline        | Common payload and resolver symptoms.                            | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [identifiers](../../internal/sdk-knowledge/native/android.md#identifier-ownership) |
| Tap or view events do not appear          | Makes consent, list wiring, and visibility actionable.           | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                             |
| Screen events appear more than once       | Activity lifecycle repeats and route-key dedupe.                 | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                             |
| Preview panel opens but shows identifiers | Missing preview Contentful client.                               | [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)                                                                                     |

## Link roles

- [The Jetpack Compose integration guide](../../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained Android reference implementation](../../../implementations/android-sdk/README.md).
