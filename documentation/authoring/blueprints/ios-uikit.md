---
sdk: ios-uikit
archetype: integration
kb: ../../internal/sdk-knowledge/native/ios.md
guide: ../../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md
---

# iOS UIKit guide blueprint

## Quick-start contract

- **Outcome:** The SDK initializes in a UIKit scene and one accepted screen event is emitted, and a
  visible label flips to an accepted state.
- **Verification:** The on-screen label reads `Optimization screen event accepted`; a `logLevel` or
  `onEventBlocked` diagnostic explains a blocked outcome so the failure branch is not a dead end.
- **Reader shape:** A UIKit `SceneDelegate` and one `UIViewController`.
- **Required artifacts:** Swift Package add and an Xcode build/run step; a `SceneDelegate` diff that
  owns one client and calls `initialize`; a view controller that tracks the current screen in
  `viewDidAppear`; the visible-label verification; a failure diagnostic.
- **Deliberate simplifications:** Consent starts granted; entry rendering is deferred to Core because
  the app must supply the Contentful fetch.
- **Explainer switches:** profile point = include; managed-fetch clause = omit.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding),
  [events](../../internal/sdk-knowledge/native/ios.md#events--tracking).

## Milestone contract

- **Milestone 1:** The SDK initialized in the scene and one accepted screen event (the quick start),
  plus entries resolving through `resolveOptimizedEntry` once the app passes fetched Contentful
  entries (the Core entry section).
- **Milestone 2:** Policy-dependent and optional layers — consent handoff, interaction tracking,
  identity, Custom Flags, live updates, preview, runtime locale changes, and offline delivery.
- **Boundary:** Mandatory scene wiring plus the first accepted event and entry render versus opt-in
  application policy and capabilities.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding),
  [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks).

## Section map

| Section                                                      | Category                       | Purpose                                                               | Must teach or show                                                                                                               | Fact sources                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package installation and SDK configuration                   | Required for first integration | Establish the package and the one `OptimizationConfig`.               | SPM add and Xcode build/run; required versus defaulted config keys; endpoint overrides only when non-default.                    | [setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding), [package](../../internal/sdk-knowledge/native/ios.md#package--entry-points) |
| Client lifetime and UIKit injection                          | Required for first integration | Own one client for the scene/app lifetime and inject it manually.     | Create-and-initialize placement; manual injection through initializers; main-actor calling; readiness.                           | [setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding)                                                                              |
| Consent and privacy-policy handoff                           | Common but policy-dependent    | Replace the quick-start default-on shortcut and explain the two axes. | Two-axis example; boolean versus split consent; pre-consent allow-list; app-owned policy.                                        | [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence)                                                                                         |
| Contentful fetching and entry resolution                     | Required for first integration | Establish the app-owned fetch and the imperative resolver.            | App owns the CDA fetch (no managed path); single-locale and include depth; synchronous fail-soft resolve; baseline fallback.     | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [fallback](../../internal/sdk-knowledge/native/ios.md#failure--fallback-behavior)   |
| Screen and navigation tracking                               | Required for first integration | Deepen the quick-start screen proof across UIKit navigation.          | `trackCurrentScreen` from `viewDidAppear`; route-key dedupe; `screen` versus `trackCurrentScreen` choice.                        | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                              |
| Entry interaction tracking                                   | Common but policy-dependent    | Explain UIKit-owned taps and view timing.                             | Tap payload from stored resolution; `ViewTrackingController` timing model; app owns geometry; opt-outs and duplicate prevention. | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                              |
| Identity, profile continuity, and reset                      | Common but policy-dependent    | Integrate login/logout and profile continuity.                        | Identify/reset example; `UserDefaults` continuity; reset preserves consent.                                                      | [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/native/ios.md#identifier-ownership)         |
| Custom events and analytics diagnostics                      | Optional                       | Cover business events and the debug/forwarding seam.                  | `track` example; passthrough `eventStream` with subscribe-before-fire; `blockedEventStream`; forwarding link.                    | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                              |
| Custom Flags and MergeTag rendering                          | Optional                       | Cover content-model-dependent reads.                                  | `getFlag` versus `flagPublisher`; `getMergeTagValue`; flag-view exposure governance.                                             | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking), [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution)               |
| Live updates and locked variants                             | Optional                       | Let UIKit apps choose live or locked content.                         | Locked snapshot versus live subscription; `nil` versus explicit selections; preview forces redraw.                               | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks)       |
| Preview panel                                                | Optional                       | Add the UIKit debug/authoring surface.                                | Debug gating; `PreviewPanelViewController`; `PreviewContentfulClient` for names; same client instance.                           | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks)                                                                                      |
| Runtime locale changes                                       | Optional                       | Handle post-startup locale switches.                                  | `setLocale` updates SDK locale only; refetch CDA and re-resolve; locale-aware cache keys.                                        | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks), [identifiers](../../internal/sdk-knowledge/native/ios.md#identifier-ownership)      |
| Offline delivery, queue observability, and app-owned caching | Advanced or production-only    | Expose production delivery posture and the app cache boundary.        | Default offline path; queue policy and callbacks; in-memory 100-event cap; app-owned content caching.                            | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks), [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)               |

## SDK-specific authoring overrides

- Omit the personalization-explainer managed-fetch clause: the iOS SDK has no fetch-by-ID path, so
  the app always owns the Contentful fetch. Facts:
  [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution).
- Prove "init plus one accepted screen event" in the quick start, keeping the existing visible-label
  proof but adding a failure-branch diagnostic. Entry rendering moves to Core because iOS has no
  managed fetch. Facts: [setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding),
  [events](../../internal/sdk-knowledge/native/ios.md#events--tracking).
- Show the `SceneDelegate` runtime root as a `+`/`-` diff, not a full paste-over: it is a file every
  app already owns. Facts: [setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding).
- Split screen, entry-interaction, and custom-event tracking into distinct sections rather than one
  multi-feature section, so each is its own reader goal with its own category. Facts:
  [events](../../internal/sdk-knowledge/native/ios.md#events--tracking).
- Use screen/tap/viewport vocabulary throughout; never import page/click/hover vocabulary from web.
  Facts: [events](../../internal/sdk-knowledge/native/ios.md#events--tracking).

## Troubleshooting scope

| Reader symptom                               | Why it belongs                                                   | Fact sources                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optimized entries always render the baseline | Common payload and resolver symptoms for imperative resolution.  | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [identifiers](../../internal/sdk-knowledge/native/ios.md#identifier-ownership) |
| Tap or view events do not appear             | Makes consent, metadata, and UIKit visibility wiring actionable. | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                         |
| Screen events appear more than once          | UIKit lifecycle repeats and route-key dedupe.                    | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                         |
| Preview panel opens but shows identifiers    | Missing preview Contentful client.                               | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks)                                                                                 |
| Identified variants disappear after relaunch | Persistence consent and profile-continuity timing.               | [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/native/ios.md#identifier-ownership)    |

## Link roles

- [The SwiftUI iOS integration guide](../../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained iOS reference implementation](../../../implementations/ios-sdk/README.md).
