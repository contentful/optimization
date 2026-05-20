---
title: iOS XCUITest failure plans
children:
  - ./variant-nested-children-stripped.md
  - ./preview-panel-overrides-locked-liveupdates.md
  - ./offline-identify-variant-resolution.md
  - ./view-tracking-timing-lifecycle.md
  - ./merge-tag-rich-text-rendering.md
  - ./flag-states-api-missing.md
---

# iOS XCUITest failure plans

Root-cause analyses and cursory fix plans for the iOS XCUITest failures found after the
`implementations/ios-sdk` suites were brought to 1:1 parity with the React Native Detox pseudocode
contracts (`implementations/react-native-sdk/e2e/*-pseudocode.md`).

At the time these were written the SwiftUI scheme passed 47 of 68 tests. Each document below covers
one root cause, names the files to change, and is self-contained enough for a fixer to act on
without re-deriving the investigation.

## Documents

| Plan                                                                                                    | Failing tests                                                                                             | Where the fix lives                 |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [Variant nested children stripped](./variant-nested-children-stripped.md)                               | 12 — all `PreviewPanelOverridesTests`, `IdentifiedVariantsTests` L1/L2, `UnidentifiedVariantsTests` L1/L2 | iOS app shell (`ContentfulFetcher`) |
| [Preview panel does not override `liveUpdates: false`](./preview-panel-overrides-locked-liveupdates.md) | 1 — `LiveUpdatesTests.testPreviewPanelEnablesLiveUpdatesForAll`                                           | iOS SDK (`OptimizedEntry`)          |
| [Offline identify never resolves the variant](./offline-identify-variant-resolution.md)                 | 2 — `OfflineBehaviorTests` continues/queue                                                                | iOS app shell + test                |
| [View-tracking timing and lifecycle](./view-tracking-timing-lifecycle.md)                               | 3 — `ExtendedViewTrackingTests` duration/dwell/pause-resume                                               | test mechanism + iOS SDK            |
| [Merge-tag rich-text rendering](./merge-tag-rich-text-rendering.md)                                     | 2 — `*VariantsTests` merge tag                                                                            | iOS SDK + app shell (new component) |
| [Flag/states API missing](./flag-states-api-missing.md)                                                 | 1 — `FlagViewTrackingTests`                                                                               | iOS SDK (new feature)               |

## Suggested order

Start with the variant-nesting plan: it is the highest-value fix (12 tests) and is contained to the
iOS demo app's link resolver. The preview-panel plan is a small, well-scoped SDK change. The
remaining plans are progressively larger — the merge-tag and flag plans describe new SDK capability,
not small fixes.
