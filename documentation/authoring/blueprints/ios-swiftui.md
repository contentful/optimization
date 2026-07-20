---
sdk: ios-swiftui
archetype: integration
kb: ../../internal/sdk-knowledge/native/ios.md
guide: ../../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md
---

# iOS SwiftUI guide blueprint

## Quick-start contract

- **Outcome:** The SDK initializes inside a SwiftUI app and one accepted screen event is emitted.
- **Verification:** With `logLevel: .debug`, launch on a simulator and observe the accepted screen
  event in the Xcode console; the Custom events section later adds a programmatic `eventStream`
  observer.
- **Reader shape:** A SwiftUI `App` whose root wraps one or more screens.
- **Required artifacts:** Swift Package add and an Xcode build/run step; `OptimizationRoot` diff
  around the app root; one screen with `.trackScreen(name:)`; a `logLevel` diagnostic; verification.
- **Deliberate simplifications:** Consent starts granted; entry rendering is deferred to Core because
  the app must supply the Contentful fetch.
- **Explainer switches:** profile point = include; managed-fetch clause = omit.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/ios.md#setup--factory),
  [events](../../internal/sdk-knowledge/native/ios.md#events--tracking),
  [package](../../internal/sdk-knowledge/native/ios.md#package--entry-points).

## Milestone contract

- **Milestone 1:** The SDK initialized and reporting one screen event (the quick start), plus entries
  resolving through `OptimizedEntry` once the app passes fetched Contentful entries (the Core entry
  sections).
- **Milestone 2:** Policy-dependent and optional layers — consent handoff, interaction tracking,
  identity, Custom Flags, live updates, preview, strict event policy, and offline delivery.
- **Boundary:** Mandatory provider wiring plus the first accepted event and entry render versus
  opt-in application policy and capabilities.
- **Fact sources:** [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks),
  [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution).

## Section map

| Section                                    | Category                       | Purpose                                                               | Must teach or show                                                                                                            | Fact sources                                                                                                                                                     |
| ------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install and initialize the SwiftUI root    | Required for first integration | Establish the SDK-owned client and the SwiftUI provider tree.         | SPM add and Xcode build/run; `OptimizationRoot` diff; `@EnvironmentObject` access; readiness gate; synchronous throwing init. | [setup](../../internal/sdk-knowledge/native/ios.md#setup--factory), [package](../../internal/sdk-knowledge/native/ios.md#package--entry-points)                  |
| Consent and privacy-policy handoff         | Common but policy-dependent    | Replace the quick-start default-on shortcut and explain the two axes. | Two-axis example; boolean versus split consent; pre-consent allow-list; app-owned policy.                                     | [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence)                                                                                       |
| Contentful entry fetching and locale shape | Required for first integration | Establish the app-owned single-locale fetch that feeds resolution.    | App owns the CDA fetch (no managed path); single-locale and include depth; SDK locale versus CDA locale.                      | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [identifiers](../../internal/sdk-knowledge/native/ios.md#identifier-ownership)    |
| Entry resolution and fallback rendering    | Required for first integration | Complete the entry half of Milestone 1 through `OptimizedEntry`.      | Render-closure example and cast; direct `resolveOptimizedEntry` alternative; baseline fallback; loading treatment.            | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [fallback](../../internal/sdk-knowledge/native/ios.md#failure--fallback-behavior) |
| Screen events and SwiftUI navigation       | Required for first integration | Deepen the quick-start screen proof across SwiftUI navigation.        | `.trackScreen` placement; `trackCurrentScreen` for dynamic names and route keys; dedupe; choose-one-path warning.             | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                            |
| Entry interaction tracking                 | Common but policy-dependent    | Explain viewport-based views and taps and their opt-outs.             | Scroll provider; thresholds; tap versus SwiftUI `Button`; `trackViews`/`trackTaps` opt-outs; `onTap` gating.                  | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                            |
| Identity, profile state, and reset         | Common but policy-dependent    | Integrate login/logout and profile continuity.                        | Identify/reset example; `UserDefaults` continuity; reset preserves consent.                                                   | [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/native/ios.md#identifier-ownership)       |
| Custom events and analytics diagnostics    | Optional                       | Cover business events and the debug/forwarding seam.                  | `track` example; passthrough `eventStream` with subscribe-before-fire; `blockedEventStream`; forwarding link.                 | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                            |
| Custom Flags and MergeTag rendering        | Optional                       | Cover content-model-dependent reads.                                  | `getFlag` versus `flagPublisher`; `getMergeTagValue`; flag-view exposure governance.                                          | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking), [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution)             |
| Live updates                               | Optional                       | Allow mounted entries to re-resolve.                                  | Root and per-entry scopes; locked-by-default explanation; preview forces live; panel-close snapshot.                          | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks)     |
| Preview panel                              | Optional                       | Add the debug/authoring surface.                                      | Debug gating; `PreviewPanelConfig`; `PreviewContentfulClient` for names; overlay placement.                                   | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks)                                                                                    |
| Strict event policy and endpoint controls  | Advanced or production-only    | Expose production privacy and endpoint posture.                       | `allowedEventTypes: []`; `onEventBlocked`/`blockedEventStream` proof; API endpoint overrides; queue policy.                   | [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence), [setup](../../internal/sdk-knowledge/native/ios.md#setup--factory)                   |
| Offline delivery and lifecycle flushing    | Advanced or production-only    | Explain constrained-network delivery.                                 | Reachability and background flush; in-memory queue plus 100-event cap; no durable outbox; `flush()` checkpoints.              | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks), [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)             |

## SDK-specific authoring overrides

- Omit the personalization-explainer managed-fetch clause: the iOS SDK has no fetch-by-ID path, so
  the app always owns the Contentful fetch. Facts:
  [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution).
- Prove "init plus one accepted screen event" rather than an entry render in the quick start: iOS has
  no managed fetch, so an entry-render proof would force an app-specific Swift CDA fetch into the
  quick start. Entry rendering moves to Core. Facts:
  [setup](../../internal/sdk-knowledge/native/ios.md#setup--factory),
  [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution).
- Keep the native package/build step inline in the quick start: add the Swift Package in Xcode, then
  build and run on a simulator (there is no `pod install`). Facts:
  [package](../../internal/sdk-knowledge/native/ios.md#package--entry-points).
- Use screen/tap/viewport vocabulary throughout; never import page/click/hover vocabulary from web.
  Facts: [events](../../internal/sdk-knowledge/native/ios.md#events--tracking).

## Troubleshooting scope

| Reader symptom                        | Why it belongs                                                     | Fact sources                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personalized content stays baseline   | Common payload, consent, and locale symptoms for entry rendering.  | [render](../../internal/sdk-knowledge/native/ios.md#render--entry-resolution), [consent](../../internal/sdk-knowledge/native/ios.md#consent--persistence) |
| Entry view or tap events are missing  | Makes viewport thresholds, scroll context, and consent actionable. | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                     |
| Screen events duplicate or go missing | Screen-modifier placement and route-key dedupe.                    | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                     |
| Preview panel shows identifiers only  | Missing preview Contentful client.                                 | [runtime](../../internal/sdk-knowledge/native/ios.md#version--runtime-quirks)                                                                             |
| Flag values do not update             | Subscription lifetime and profile-change dependency.               | [events](../../internal/sdk-knowledge/native/ios.md#events--tracking)                                                                                     |

## Link roles

- [The UIKit iOS integration guide](../../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained iOS reference implementation](../../../implementations/ios-sdk/README.md).
