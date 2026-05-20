# iOS XCUITest fix plan — results

Outcome of executing the six fix plans in this directory and re-running the iOS XCUITest suites.
Both the SwiftUI and UIKit schemes now pass in full.

## SwiftUI scheme — 68 / 68 passing

Baseline was 47 / 68 (see [README](./README.md)). All six plans were applied and the full
`OptimizationAppUITestsSwiftUI` suite now passes.

| Plan                                                                                     | Tests it targeted                                                                                   | Result  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| [Variant nested children stripped](./variant-nested-children-stripped.md)                | `IdentifiedVariantsTests` L1/L2, `UnidentifiedVariantsTests` L1/L2, `PreviewPanelOverridesTests` ×8 | passing |
| [Preview panel vs `liveUpdates: false`](./preview-panel-overrides-locked-liveupdates.md) | `LiveUpdatesTests` ×11                                                                              | passing |
| [Offline identify variant resolution](./offline-identify-variant-resolution.md)          | `OfflineBehaviorTests` ×4                                                                           | passing |
| [View-tracking timing and lifecycle](./view-tracking-timing-lifecycle.md)                | `ExtendedViewTrackingTests` ×10                                                                     | passing |
| [Merge-tag rich-text rendering](./merge-tag-rich-text-rendering.md)                      | merge-tag variant cases ×2                                                                          | passing |
| [Flag/states API missing](./flag-states-api-missing.md)                                  | `FlagViewTrackingTests` ×1                                                                          | passing |

### What changed, per plan

1. **Variant nesting** — `ContentfulFetcher.resolveValue` now counts logical link hops (cap of 10)
   instead of every JSON-tree node, so `nested` arrays under the `nt_experiences` → `nt_variants`
   chain are fully resolved. Separately, `PreviewPanelOverridesTests.identifyAndRelaunch` was
   relaunching with a stale `--reset` argument that wiped the just-identified profile — it now
   clears the launch arguments first.
2. **Preview panel precedence** — `OptimizedEntry.shouldLiveUpdate` (SDK) and
   `OptimizedEntryUIView.shouldLiveUpdate` now check `client.isPreviewPanelOpen` first, so an open
   panel overrides an explicit `liveUpdates: false`.
3. **Offline identify** — replaced the relaunch-based offline simulation with runtime `Go Offline` /
   `Go Online` controls (gated behind `--enable-network-controls`) so the in-memory Experience queue
   survives the offline → online transition. `OfflineBehaviorTests` drives those controls.
4. **View tracking** — test-mechanism fixes only (the SDK lifecycle was already correct after the
   `resume()`-from-stored-geometry commit). Added momentum-free scroll helpers; the home content
   entries were given a card-sized minimum height so the "below-fold" entry genuinely starts off
   screen, as the cross-platform contract assumes.
5. **Merge tags** — added `getMergeTagValue` to the JSC bridge and `OptimizationClient`, a Swift
   rich-text flattener (`shared/RichText.swift`), and wired it into the four content views.
6. **Flag API** — added `flag(name)` to the JSC bridge and `OptimizationClient.subscribeToFlag`; the
   app shells subscribe to the `boolean` flag once a profile is available. The SwiftUI `EventStore`
   subscription was moved earlier (into `MainScreen.task`) so the synchronous flag-view event is not
   dropped by the `PassthroughSubject`.

## UIKit scheme — 68 / 68 passing

Running the same shared XCUITest suite against `OptimizationAppUIKit` initially surfaced 14 failures
in two UIKit-specific areas the SwiftUI-authored plans never audited (`PreviewPanelOverridesTests`
×8 and `LiveUpdatesTests` ×6). Both clusters shared one root cause and are now fixed; the full UIKit
suite passes.

### Root cause and fix

UIKit's `OptimizedEntryUIView` never re-resolved its content when personalization state changed
(after `identify` or after a preview-panel override). The SwiftUI `OptimizedEntry` re-resolves
reactively on every `body` pass, but `OptimizedEntryUIView` relies on explicit Combine sinks over
`client.$selectedPersonalizations` / `client.$isPreviewPanelOpen`. `@Published` fires inside
`willSet`, so a synchronous sink read the _previous_ value back off the client and re-resolved to
stale data. Adding `.receive(on: RunLoop.main)` to both subscriptions defers re-resolution to the
next run-loop turn, after the new value is committed.

`uikit/SceneDelegate.swift` was also updated to hand the preview panel a real
`MockPreviewContentfulClient` instead of `nil`, matching the SwiftUI app, so the panel can load
audience and experience definitions.

### Regression found and fixed during this work

The plan 4 minimum-height constraint, when first added to `ContentEntryUIView` with a
`lessThanOrEqual` bottom pin, left the view's height ambiguous and broke the UIKit scroll-content
layout (`AnalyticsTests` failed with an invalid-frame hittability error). It was corrected to an
equal-bottom pin plus a `greaterThanOrEqual` height constraint, which is unambiguous.
