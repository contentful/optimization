# iOS SDK has no flag/states API, so flag view tracking is unverifiable

## Summary

`FlagViewTrackingTests.testEmitsFlagViewEventsForSubscribedBooleanFlag` fails because the
`event-count-boolean` analytics label is never produced on iOS. The label depends on a flag
subscription (`sdk.states.flag('boolean').subscribe(...)`) emitting a `component` view event, but
the iOS SDK's public `OptimizationClient` exposes no `states` namespace and no `flag()` API at all.
This is a missing SDK feature, not a small fix: closing it requires adding a flag observable to the
iOS SDK, exposing it through the JS-core bridge, and subscribing to it from the iOS app shells.

## Affected tests

- `implementations/ios-sdk/uitests/Tests/FlagViewTrackingTests.swift` —
  `testEmitsFlagViewEventsForSubscribedBooleanFlag`

## Evidence

Test log (`/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log`), searching
`testEmitsFlagViewEventsForSubscribedBooleanFlag`:

```
1152: Test Case '-[OptimizationAppUITestsSwiftUI.FlagViewTrackingTests testEmitsFlagViewEventsForSubscribedBooleanFlag]' started.
1365: /Users/alexander.freas/github/optimization/implementations/ios-sdk/uitests/Support/TestHelpers.swift:61: error: -[OptimizationAppUITestsSwiftUI.FlagViewTrackingTests testEmitsFlagViewEventsForSubscribedBooleanFlag] : failed - Timed out waiting for text condition on "event-count-boolean". Last text: ""
1367: Test Case '-[OptimizationAppUITestsSwiftUI.FlagViewTrackingTests testEmitsFlagViewEventsForSubscribedBooleanFlag]' failed (28.913 seconds).
```

The element `event-count-boolean` never receives text (`Last text: ""`), so the
`waitForComponentEventCount("boolean", minCount: 1, ...)` step in the test times out.

Confirmation the iOS public API lacks a flag/states API — the full public surface of
`OptimizationClient`
(`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`)
is:

- Lifecycle: `initialize(config:)`, `destroy()`
- Analytics/identity: `identify`, `page`, `screen`, `flush`, `trackView`, `trackClick`
- Personalization: `personalizeEntry`, `getProfile`, `getState`
- Consent/network/reset: `consent`, `reset`, `setOnline`
- Preview panel: `setPreviewPanelOpen`, `overrideAudience`, `overrideVariant`,
  `resetAudienceOverride`, `resetVariantOverride`, `resetAllOverrides`, `loadDefinitions`,
  `getPreviewState`, `refreshPreviewState`
- Reactive `@Published` properties: `state`, `isInitialized`, `selectedPersonalizations`,
  `isPreviewPanelOpen`, `previewState`
- Test-only hooks: `testOnlySetLogHandler`, `testOnlyEvaluateScript`

There is no `states` property, no `flag(_:)` method, and no flag-value publisher.

The JS-core bridge that the iOS SDK wraps (`packages/ios/ios-jsc-bridge/src/index.ts`) also has no
flag method: the `Bridge` interface declares `initialize`, `identify`, `page`, `getProfile`,
`getState`, `destroy`, `screen`, `flush`, `trackView`, `trackClick`, `consent`, `reset`,
`personalizeEntry`, `setOnline`, and the preview-panel methods — but nothing for flags. So even if
Swift wanted to call a flag method, the bridge does not expose `__bridge.flag(...)`.

## Root cause analysis

The missing feature is an iOS equivalent of the JS core's `states.flag(name)` API and its bridging.

How the analytics label is produced end to end:

1. The host app subscribes to a named flag.
2. On subscribe (and on each distinct value change), the JS core's flag observable calls
   `trackFlagView({ componentId: name, ... })`
   (`packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts`, `getFlagObservable`).
3. `trackFlagView` is mapped to event type `component` (`CONSENT_EVENT_TYPE_MAP` in
   `CoreStatefulEventEmitter.ts`: `trackFlagView: 'component'`).
4. That `component` event flows through the SDK's event stream.
5. On iOS, the bridge's event effect forwards every emitted event to
   `__nativeOnEventEmitted(JSON.stringify(evt))` (`packages/ios/ios-jsc-bridge/src/index.ts`,
   `disposeEventEffect`).
6. `JSContextManager` delivers it to `OptimizationClient.eventPublisher`.
7. `EventStore.processEvent` (`implementations/ios-sdk/shared/EventStore.swift`) sees
   `type == "component"` with `componentId == "boolean"` and increments `componentStats["boolean"]`.
8. `AnalyticsEventDisplay` renders the `componentStats` entry with accessibility identifier
   `event-count-boolean` (`implementations/ios-sdk/swiftui/Components/AnalyticsEventDisplay.swift`,
   `componentStatsSection`).

The iOS event-forwarding pipeline (steps 5-8) already works for `trackView` `component` events, so
if a flag-view `component` event were emitted it would surface as `event-count-boolean` with no
further app changes. The break is entirely at steps 1-2: nothing on iOS ever subscribes to a flag,
because there is no API to subscribe to. The iOS app shells (`MainScreen.swift`,
`MainViewController.swift`) have no flag subscription, mirroring the gap — they cannot call an API
that does not exist.

This is consistent with the platform note already in the test file's doc comment:

> the iOS implementation app shells (`swiftui`/`uikit`) do not currently call
> `sdk.states.flag("boolean").subscribe()`, so the `event-count-boolean` stats label is not
> produced.

## Reference: how React Native does it

The React Native app exposes the JS core's stateful API directly. In
`implementations/react-native-sdk/App.tsx` (around line 84), once consent and a profile exist:

```ts
const flagSubscription = sdk.states.flag('boolean').subscribe(() => undefined)
// ...
return () => {
  flagSubscription.unsubscribe()
}
```

`sdk.states.flag(name)` returns an `Observable<Json>` from `CoreStateful`
(`packages/universal/core-sdk/src/CoreStateful.ts`, `states.flag` -> `getFlagObservable(name)`).
What that observable does (`packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts`):

- It wraps a computed signal of the flag's resolved value
  (`super.getFlag(name, changesSignal.value)`), de-duplicated with `toDistinctObservable`.
- Its `current` getter, and every `subscribe`/`subscribeOnce` notification, calls
  `trackFlagView(buildFlagViewBuilderArgs(name, changesSignal.value))`.
- `buildFlagViewBuilderArgs` produces `{ componentId: name, experienceId?, variantIndex? }`, where
  `experienceId`/`variantIndex` come from any matching `changes` entry keyed by the flag name.
- `trackFlagView` emits a `component`-typed event through the event stream (see
  `CONSENT_EVENT_TYPE_MAP`).

So in RN, subscribing to the `boolean` flag emits at least one `component` view event tagged
`componentId: "boolean"`. RN's analytics display surfaces that as `event-count-boolean`, which is
exactly what the cross-platform `flag-view-tracking` contract
(`implementations/react-native-sdk/e2e/flag-view-tracking.test.js` and
`flag-view-tracking-pseudocode.md`) asserts via `waitForTrackedItemEventCount('boolean', 1, ...)`.

The flag observable is also lazily cached per name in `flagObservables`, so repeated
`states.flag('boolean')` calls return the same observable.

## Fix plan

This is a new SDK feature. It spans the JS-core bridge, the Swift SDK, and the iOS app shells. Scope
it as a genuine feature addition with bridge, SDK, and shell changes plus tests — not a one-line
patch.

1. **Add a flag method to the JS-core bridge** (`packages/ios/ios-jsc-bridge/src/index.ts`):
   - Add to the `Bridge` interface a flag entry point, e.g. `flag(name: string): string` returning
     the current flag value as JSON, with the side effect of subscribing through the core so a
     `component` view event is emitted.
   - In the implementation, call `instance.states.flag(name)`. The core's flag observable already
     fires `trackFlagView` on `subscribe` (and on `current` access). Mirror the existing state-push
     pattern: keep a per-name subscription so each distinct flag value change re-emits. Store the
     subscription disposers so `destroy()` can clean them up alongside `disposeEffect` and
     `disposeEventEffect`.
   - The emitted `component` event already reaches Swift through the existing
     `__nativeOnEventEmitted` event effect — no new native callback is required for the event
     itself.
   - Decide whether the flag value should also be surfaced reactively (see step 2). If so, push it
     either through the existing `__nativeOnStateChange` payload (extending `BridgeState`) or via a
     dedicated callback such as `__nativeOnFlagChanged(name, json)`, modeled on
     `__nativeOnOverridesChanged`.
   - Rebuild the bridge bundle so
     `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`
     reflects the new method (the iOS SDK loads this UMD bundle, not the TS source).

2. **Add a flag API to `OptimizationClient`**
   (`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`):
   - Add a public method to subscribe to a flag by name, e.g. `func flag(_ name: String) -> ...`.
     Two viable shapes, in increasing fidelity to RN:
     - Minimal: `func subscribeToFlag(_ name: String)` that calls
       `bridgeCallSyncWhenInitialized(method: "flag", args: "'<escaped name>'")` once. This is
       enough to trigger the JS-core subscription and emit the `component` view event that
       `event-count-boolean` needs.
     - Reactive (preferred, matches RN's `states.flag`): expose a flag-value publisher. Add a
       `@Published`/`PassthroughSubject`-backed surface keyed by flag name, populated from the JS
       push wired in step 1. Model this on the existing reactive state push: `bridge.onStateChange`
       -> `handleStateUpdate` -> `@Published state`, and `bridge.onOverridesChanged` ->
       `@Published previewState`. A `flagPublisher(name:)` returning
       `AnyPublisher<JSONValue, Never>` keeps Swift thin and pushes all logic into the JS core,
       consistent with the repo's "push logic into the JS bridge" guidance.
   - Escape the flag name with `NativePolyfills.escapeForJS` exactly as `overrideAudience`,
     `overrideVariant`, and the override-reset methods do, since the name is interpolated into a
     `__bridge.flag('<name>')` call string.
   - Add a corresponding callback property on `JSContextManager` (e.g. `onFlagChanged`) and register
     the native callback in `JSContextManager.initialize`, mirroring `__nativeOnOverridesChanged` /
     `handleOverridesChanged`, if step 1 chose a dedicated callback.

3. **Subscribe from the iOS app shells** so the `boolean` flag view event is produced:
   - SwiftUI: in `implementations/ios-sdk/swiftui/Screens/MainScreen.swift`, after consent and a
     profile are available (the same gating RN uses — `App.tsx` only subscribes once
     `hasConsent && hasProfile`), call the new flag API for `"boolean"`. A natural spot is inside
     the `onReceive` profile handler that already runs once a profile resolves, or a dedicated
     `.task`/`.onChange` keyed on `client.state.profile != nil` and consent. Ensure it subscribes
     once and tears down on disappear if a reactive subscription is used.
   - UIKit: make the equivalent change in
     `implementations/ios-sdk/uikit/Screens/MainViewController.swift` so both shells satisfy the
     contract.
   - No change is needed in `EventStore.swift` or `AnalyticsEventDisplay.swift`: a `component` event
     with `componentId: "boolean"` already maps to `componentStats["boolean"]` and renders as
     `event-count-boolean`.

4. **Validate**:
   - Rebuild the iOS bridge bundle and the iOS SDK package.
   - Run `FlagViewTrackingTests.testEmitsFlagViewEventsForSubscribedBooleanFlag` against both the
     SwiftUI and UIKit app targets; confirm `event-count-boolean` reaches `Count: 1` or higher.
   - Add JS-core bridge unit coverage for the new `flag` method, paralleling existing bridge tests.
   - Consider an iOS-native SDK test exercising the flag API end to end, consistent with the repo
     note that the iOS-native SDK tests act as bridge proof for the thin JS-bridge wrappers.

## Risks and open questions

- **Subscription lifecycle.** The JS-core flag observable is cached per name in `flagObservables`,
  and `getFlagObservable` is `protected` on `CoreStatefulEventEmitter`. The bridge must hold and
  dispose its flag subscriptions (mirroring `disposeEffect`) so `destroy()` and `reset()` do not
  leak subscriptions or double-emit after re-initialization.
- **Event-emission timing vs. consent.** `trackFlagView` events flow through the consent guard. RN
  gates its flag subscription on `hasConsent && hasProfile`; the iOS shells must apply the same
  gating or the first flag view event may be blocked or arrive before consent. Confirm whether the
  `component` event type is permitted pre-consent (`allowedEventTypes` /
  `DEFAULT_ALLOWED_EVENT_TYPES`).
- **One emission vs. continuous.** The contract only requires `count >= 1`. The minimal approach (a
  single `__bridge.flag('boolean')` call) satisfies the test. Decide whether to also deliver the
  reactive value stream now or defer it; the reactive surface is closer to RN but is more surface
  area to design, type, and bridge.
- **Flag value typing across the bridge.** A flag value is arbitrary JSON. The Swift surface needs a
  JSON value type for the reactive variant; check whether an existing type (e.g. the `JSONValue`
  used by `PreviewState`) can be reused rather than introducing a new one.
- **`getFlag` side effect.** `CoreStatefulEventEmitter.getFlag` itself also emits `trackFlagView` on
  a distinct value (independent of `getFlagObservable`). Ensure the bridge does not double-count by
  both reading the value and subscribing in a way that fires two `component` events for the same
  subscribe; the test tolerates `count >= 1`, but downstream analytics consumers may not.
- **Bundle regeneration.** The iOS SDK consumes the prebuilt `optimization-ios-bridge.umd.js`
  resource. The fix is incomplete until that bundle is rebuilt; editing only
  `ios-jsc-bridge/src/index.ts` has no runtime effect on the app.

## Related files

- `implementations/ios-sdk/uitests/Tests/FlagViewTrackingTests.swift` — failing test
- `implementations/ios-sdk/uitests/Support/TestHelpers.swift` — `waitForComponentEventCount`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`
  — public iOS SDK API (no flag/states API)
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift`
  — JS bridge wiring, native callbacks, event delivery
- `packages/ios/ios-jsc-bridge/src/index.ts` — JS-core bridge surface (no `flag` method)
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`
  — prebuilt bridge bundle loaded at runtime
- `packages/universal/core-sdk/src/CoreStateful.ts` — `states.flag` definition
- `packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts` — `getFlagObservable`,
  `buildFlagViewBuilderArgs`, `trackFlagView`, `CONSENT_EVENT_TYPE_MAP`
- `implementations/react-native-sdk/App.tsx` — reference flag subscription (around line 84)
- `implementations/react-native-sdk/e2e/flag-view-tracking.test.js` — cross-platform contract
- `implementations/react-native-sdk/e2e/flag-view-tracking-pseudocode.md` — contract pseudocode
- `implementations/ios-sdk/shared/EventStore.swift` — maps `component` events to `componentStats`
- `implementations/ios-sdk/swiftui/Components/AnalyticsEventDisplay.swift` — renders
  `event-count-<componentId>`
- `implementations/ios-sdk/swiftui/Screens/MainScreen.swift` — SwiftUI shell (no flag subscription)
- `implementations/ios-sdk/uikit/Screens/MainViewController.swift` — UIKit shell (no flag
  subscription)
