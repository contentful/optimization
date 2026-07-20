---
sdk: android-compose
archetype: integration
kb: ../../internal/sdk-knowledge/native/android.md
guide: ../../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md
---

# Android Jetpack Compose guide blueprint

## Quick-start contract

- **Outcome:** The SDK initializes inside a Compose app and one accepted screen event is emitted.
- **Verification:** With `logLevel = debug`, run on a device/emulator and find the accepted screen
  event in logcat by a named tag/token; the Custom events section later adds a programmatic
  `eventStream` observer.
- **Reader shape:** A Compose `Activity` whose `setContent` wraps the app UI.
- **Required artifacts:** Maven Central dependency; `OptimizationRoot` diff around the app root; one
  screen with `ScreenTrackingEffect`; a `logLevel` diagnostic; verification.
- **Deliberate simplifications:** Consent starts granted; entry rendering is deferred to Core because
  the app must supply the Contentful fetch.
- **Explainer switches:** profile point = include; managed-fetch clause = omit.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/android.md#setup--factory),
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking),
  [package](../../internal/sdk-knowledge/native/android.md#package--entry-points).

## Milestone contract

- **Milestone 1:** The SDK initialized and reporting one screen event (the quick start), plus entries
  resolving through `OptimizedEntry` once the app passes fetched Contentful entries (the Core entry
  sections).
- **Milestone 2:** Policy-dependent and optional layers — consent handoff, interaction tracking,
  identity, Custom Flags, live updates, preview, strict event policy, offline delivery, and caching.
- **Boundary:** Mandatory provider wiring plus the first accepted event and entry render versus
  opt-in application policy and capabilities.
- **Fact sources:** [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks),
  [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution).

## Section map

| Section                                          | Category                       | Purpose                                                               | Must teach or show                                                                                                                 | Fact sources                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install and initialize `OptimizationRoot`        | Required for first integration | Establish the SDK-owned client and the Compose provider tree.         | Maven Central dependency; `OptimizationRoot` diff; `LocalOptimizationClient` access; loading gate; suspend init and Flow surfaces. | [setup](../../internal/sdk-knowledge/native/android.md#setup--factory), [package](../../internal/sdk-knowledge/native/android.md#package--entry-points)                  |
| Consent and privacy-policy handoff               | Common but policy-dependent    | Replace the quick-start default-on shortcut and explain the two axes. | Two-axis example; boolean versus split consent; pre-consent allow-list; app-owned policy.                                          | [consent](../../internal/sdk-knowledge/native/android.md#consent--persistence)                                                                                           |
| Contentful entry fetching and locale shape       | Required for first integration | Establish the app-owned single-locale fetch that feeds resolution.    | App owns the CDA fetch (no managed path); single-locale and include depth; SDK locale versus CDA locale.                           | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [identifiers](../../internal/sdk-knowledge/native/android.md#identifier-ownership)    |
| Entry resolution and fallback rendering          | Required for first integration | Complete the entry half of Milestone 1 through `OptimizedEntry`.      | Render-lambda example; direct suspend `resolveOptimizedEntry` alternative; baseline fallback; loading treatment.                   | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [fallback](../../internal/sdk-knowledge/native/android.md#failure--fallback-behavior) |
| Screen and navigation tracking                   | Required for first integration | Deepen the quick-start screen proof across Compose navigation.        | `ScreenTrackingEffect` placement; `trackCurrentScreen` for dynamic names and route keys; dedupe; one-path warning.                 | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                                |
| Entry interaction tracking                       | Common but policy-dependent    | Explain viewport-based views and taps and their opt-outs.             | `OptimizationLazyColumn`; thresholds; tap versus app click; `trackViews`/`trackTaps` opt-outs; `onTap` baseline note.              | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                                |
| Identity, profile continuity, and reset          | Common but policy-dependent    | Integrate login/logout and profile continuity.                        | Identify/reset example; `SharedPreferences` continuity; reset preserves consent.                                                   | [consent](../../internal/sdk-knowledge/native/android.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/native/android.md#identifier-ownership)       |
| Custom events and analytics diagnostics          | Optional                       | Cover business events and the debug/forwarding seam.                  | `track` example; `SharedFlow` `eventStream` replay-buffer semantics; `blockedEventStream`; forwarding link.                        | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                                |
| Custom Flags and MergeTag rendering              | Optional                       | Cover content-model-dependent reads.                                  | `getFlag` versus `observeFlag` `StateFlow`; `getMergeTagValue`; flag-view exposure governance.                                     | [events](../../internal/sdk-knowledge/native/android.md#events--tracking), [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution)             |
| Live updates                                     | Optional                       | Allow mounted entries to re-resolve.                                  | Root and per-entry scopes; locked-by-default explanation; preview forces live; panel-close snapshot.                               | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)     |
| Preview panel                                    | Optional                       | Add the debug/authoring surface.                                      | Debug gating; `PreviewPanelConfig`; `PreviewContentfulClient` for names; overlay in the Compose tree.                              | [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)                                                                                        |
| Strict event policy and queue controls           | Advanced or production-only    | Expose production privacy and delivery posture.                       | `allowedEventTypes = emptyList()`; `onEventBlocked`/`blockedEventStream` proof; queue policy; blocked not replayed.                | [consent](../../internal/sdk-knowledge/native/android.md#consent--persistence), [setup](../../internal/sdk-knowledge/native/android.md#setup--factory)                   |
| Offline delivery and lifecycle flushing          | Advanced or production-only    | Explain constrained-network delivery.                                 | Reachability and background flush; in-memory queue plus 100-event cap; no durable outbox; deterministic controls.                  | [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks), [events](../../internal/sdk-knowledge/native/android.md#events--tracking)             |
| Content caching and hybrid continuity boundaries | Advanced or production-only    | Bound app-owned caching against SDK persistence.                      | App owns CDA caching and locale-aware keys; native has no server/browser continuity handoff.                                       | [identifiers](../../internal/sdk-knowledge/native/android.md#identifier-ownership), [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)    |

## SDK-specific authoring overrides

- Omit the personalization-explainer managed-fetch clause: the Android SDK has no fetch-by-ID path,
  so the app always owns the Contentful fetch. Facts:
  [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution).
- Prove "init plus one accepted screen event" rather than an entry render in the quick start: Android
  has no managed fetch, so an entry-render proof would force an app-specific Kotlin CDA fetch into the
  quick start. Entry rendering moves to Core. Facts:
  [setup](../../internal/sdk-knowledge/native/android.md#setup--factory),
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).
- Keep the dependency/build step inline in the quick start: add the Maven Central dependency and run a
  Gradle build; there is no separate native prebuild. Facts:
  [package](../../internal/sdk-knowledge/native/android.md#package--entry-points).
- Use screen/tap/viewport vocabulary throughout; never import hover vocabulary from web, and do not
  put `page` in pre-consent blocked-event lists unless the guide first teaches `client.page`. Facts:
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).
- Note that `eventStream`/`blockedEventStream` are replay-buffered `SharedFlow`s (late subscribers
  receive recent events), unlike the iOS passthrough streams. Facts:
  [events](../../internal/sdk-knowledge/native/android.md#events--tracking).

## Troubleshooting scope

| Reader symptom                        | Why it belongs                                                    | Fact sources                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No OptimizationClient provided`      | Calling SDK helpers outside `OptimizationRoot`.                   | [setup](../../internal/sdk-knowledge/native/android.md#setup--factory)                                                                                            |
| Entries always render baseline        | Common payload, consent, and locale symptoms for entry rendering. | [render](../../internal/sdk-knowledge/native/android.md#render--entry-resolution), [consent](../../internal/sdk-knowledge/native/android.md#consent--persistence) |
| Entry view or tap events are missing  | Makes viewport thresholds, list tracking, and consent actionable. | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                         |
| Screen events duplicate or go missing | Effect placement and route-key dedupe.                            | [events](../../internal/sdk-knowledge/native/android.md#events--tracking)                                                                                         |
| Preview panel shows identifiers only  | Missing preview Contentful client.                                | [runtime](../../internal/sdk-knowledge/native/android.md#version--runtime-quirks)                                                                                 |

## Link roles

- [The Android Views integration guide](../../guides/integrating-the-optimization-android-sdk-in-a-views-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained Android reference implementation](../../../implementations/android-sdk/README.md).
