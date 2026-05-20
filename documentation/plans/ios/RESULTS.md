# iOS XCUITest fix plan — results

Outcome of executing the six fix plans in this directory and re-running the iOS XCUITest suites.

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

## UIKit scheme — 54 / 68 passing

The six plans were authored solely from the SwiftUI run (the README states the baseline as "the
SwiftUI scheme passed 47 of 68"). Running the same shared XCUITest suite against
`OptimizationAppUIKit` surfaces 14 failures in two UIKit-specific areas the plans never audited.
Every test the six plans target **does** pass on UIKit — including `IdentifiedVariantsTests`,
`UnidentifiedVariantsTests`, `OfflineBehaviorTests`, `ExtendedViewTrackingTests`,
`FlagViewTrackingTests`, and `AnalyticsTests`.

### Still failing — pre-existing UIKit gaps, outside plan scope

**`PreviewPanelOverridesTests` ×8** — the UIKit preview panel opens (`Preview Panel` title appears)
but renders no audience or variant controls: every `audience-toggle-*` / variant-picker /
`Identified Users` lookup finds no match, and no `Loading definitions...` state is shown. The panel
never surfaces the audience section. The audience/variant override UI for
`PreviewPanelViewController` appears unimplemented on UIKit. `identifyAndRelaunch` itself passes, so
plan 1's fixes are confirmed working on UIKit too — the failure is purely the missing panel UI.
(`uikit/SceneDelegate.swift` was also updated to pass a real `MockPreviewContentfulClient` instead
of `nil`, matching the SwiftUI app; this is a necessary prerequisite but is not sufficient on its
own.)

**`LiveUpdatesTests` ×6** — the UIKit `LiveUpdates` test screen's `OptimizedEntryUIView` sections do
not re-resolve after `identify`: the `*-entry-id` labels stay at their pre-identify value. The
SwiftUI `OptimizedEntry` re-resolves reactively on every `body` pass; the UIKit
`OptimizedEntryUIView` depends entirely on its `subscribeToPersonalizations` sink driving
`rebuildContent()`, and that path is not updating the rendered entry. The five `LiveUpdatesTests`
that do not assert an entry-id change still pass.

Both clusters are genuine UIKit-side gaps in the preview-panel and live-update integration. They are
not regressions from this work: the SwiftUI equivalents of all 14 tests pass, and the only SDK
change touching `OptimizedEntryUIView` (`shouldLiveUpdate`) is behaviourally identical to the
previous code for these cases. Closing them is a separate effort — implementing the UIKit
preview-panel audience/variant UI and fixing `OptimizedEntryUIView` re-resolution — and was not part
of the six SwiftUI-scoped plans.

### Regression found and fixed during this work

The plan 4 minimum-height constraint, when first added to `ContentEntryUIView` with a
`lessThanOrEqual` bottom pin, left the view's height ambiguous and broke the UIKit scroll-content
layout (`AnalyticsTests` failed with an invalid-frame hittability error). It was corrected to an
equal-bottom pin plus a `greaterThanOrEqual` height constraint, which is unambiguous;
`AnalyticsTests` passes.
