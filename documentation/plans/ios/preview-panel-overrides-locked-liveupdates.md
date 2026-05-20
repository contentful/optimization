# Preview panel does not override an explicit `liveUpdates: false` on iOS

## Summary

`LiveUpdatesTests.testPreviewPanelEnablesLiveUpdatesForAll` fails because the iOS SDK's
`shouldLiveUpdate` computed property returns an explicit per-component `liveUpdates` value
unconditionally, before it ever consults `client.isPreviewPanelOpen`. As a result, a section
configured with `liveUpdates: false` (the "locked" section) stays locked even while the preview
panel is open, so its resolved entry never re-resolves on identify. The contract — confirmed by the
React Native and web SDKs — is that an open preview panel overrides any explicit `liveUpdates`
value, including `false`, while the global live-updates toggle does not.

## Affected tests

- `implementations/ios-sdk/uitests/Tests/LiveUpdatesTests.swift` —
  `testPreviewPanelEnablesLiveUpdatesForAll`

## Evidence

Test log: `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log`

The test opens the preview panel (`preview-panel-status` -> `Open`), captures the three section
entry ids, taps identify (`identified-status` -> `Yes`), then waits for all three `*-entry-id`
elements to change. The `default` and `live` sections re-resolve, but `locked-entry-id` never
changes:

```
.../uitests/Support/TestHelpers.swift:61: error: -[OptimizationAppUITestsSwiftUI.LiveUpdatesTests
testPreviewPanelEnablesLiveUpdatesForAll] : failed - Timed out waiting for text condition on
"locked-entry-id". Last text: "Entry: 1UFf7qr4mHET3HYuYmcpEj"

Test Case '-[OptimizationAppUITestsSwiftUI.LiveUpdatesTests
testPreviewPanelEnablesLiveUpdatesForAll]' failed (27.775 seconds).
```

The `locked-entry-id` text holds at its pre-identify value (`Entry: 1UFf7qr4mHET3HYuYmcpEj`),
proving the locked section did not switch to live-update mode while the panel was open.

## Root cause analysis

The screen wiring is correct. `LiveUpdatesTestScreen.swift` (SwiftUI) and
`LiveUpdatesTestViewController.swift` (UIKit) both call `client.setPreviewPanelOpen(...)` from the
"Simulate Preview Panel" button, and the locked section is built with `liveUpdates: false`. The
preview panel status flips to `Open` in the log, so `client.isPreviewPanelOpen` is `true` when
identify fires.

The bug is in the SDK's `shouldLiveUpdate` precedence. In
`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift`:

```swift
private var shouldLiveUpdate: Bool {
    if let explicit = liveUpdates { return explicit }
    return trackingConfig.liveUpdates || client.isPreviewPanelOpen
}
```

When `liveUpdates` is explicitly set, the function returns that value immediately and the
`client.isPreviewPanelOpen` branch is never reached. For the locked section, `liveUpdates` is
`false`, so `shouldLiveUpdate` is `false` regardless of the preview panel. Consequently
`effectivePersonalizations` keeps returning `lockedPersonalizations`, the entry never re-resolves,
and `locked-entry-id` never changes.

`implementations/ios-sdk/uikit/Components/OptimizedEntryUIView.swift` has the identical bug with the
UIKit-local `globalLiveUpdates` field:

```swift
private var shouldLiveUpdate: Bool {
    if let explicit = liveUpdates { return explicit }
    return globalLiveUpdates || client.isPreviewPanelOpen
}
```

The fix must keep one distinction intact: an open preview panel must override an explicit
`liveUpdates: false`, but the global toggle must NOT. The global toggle only acts as the default
when `liveUpdates` is `nil`.

## Reference: expected precedence

The React Native SDK (`packages/react-native-sdk/src/components/OptimizedEntry.tsx`) is canonical:

```ts
const shouldLiveUpdate =
  liveUpdatesContext?.previewPanelVisible === true ||
  (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)
```

The web SDK uses the same precedence via `resolveShouldLiveUpdate` in
`packages/web/frameworks/react-web-sdk/src/optimized-entry/useOptimizedEntry.ts` /
`optimizedEntryUtils.ts`.

Precedence, highest to lowest:

1. **Preview panel open** -> always live (`true`). Overrides everything, including an explicit
   `liveUpdates: false`.
2. **Explicit per-component `liveUpdates`** -> use that value (`true` or `false`). Overrides the
   global toggle.
3. **Global toggle** -> used only when `liveUpdates` is `nil`.
4. Default -> `false`.

The RN public TSDoc states this explicitly: "Live updates are always enabled when the preview panel
is open, regardless of this setting." The iOS SDK violates this by ranking the explicit value above
the preview panel.

## Fix plan

1. In
   `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift`,
   replace `shouldLiveUpdate` so the preview panel is checked first and short-circuits:

   ```swift
   private var shouldLiveUpdate: Bool {
       if client.isPreviewPanelOpen { return true }
       if let explicit = liveUpdates { return explicit }
       return trackingConfig.liveUpdates
   }
   ```

2. In `implementations/ios-sdk/uikit/Components/OptimizedEntryUIView.swift`, apply the equivalent
   change using the UIKit-local `globalLiveUpdates` field:

   ```swift
   private var shouldLiveUpdate: Bool {
       if client.isPreviewPanelOpen { return true }
       if let explicit = liveUpdates { return explicit }
       return globalLiveUpdates
   }
   ```

   This preserves the exact precedence: preview panel beats the explicit value beats the global
   default.

3. No screen wiring changes are needed. `LiveUpdatesTestScreen.swift` and
   `LiveUpdatesTestViewController.swift` already drive `client.setPreviewPanelOpen(...)` from the
   "Simulate Preview Panel" button, and both build the locked section with `liveUpdates: false`.

4. Run the full `LiveUpdatesTests` suite (SwiftUI and UIKit hosts) and confirm:
   - `testPreviewPanelEnablesLiveUpdatesForAll` now passes — all three sections, including the
     locked one, re-resolve while the panel is open.
   - **No regression** in `testLockedComponentDoesNotUpdateEvenWhenGlobalOn` and
     `testLockedComponentsIgnoreGlobalLiveUpdates`. With the preview panel closed,
     `client.isPreviewPanelOpen` is `false`, so the first guard does not fire and an explicit
     `liveUpdates: false` still wins over the global `ON` toggle — the locked section stays locked.
   - `testLiveComponentUpdatesRegardlessOfGlobal`, `testGlobalLiveUpdatesEnablesDefaultComponents`,
     and `testDefaultDoesNotUpdateOnIdentifyGlobalLiveUpdatesFalse` still pass — explicit `true`,
     global-driven default, and global-off default behaviors are unchanged when the panel is closed.

## Risks and open questions

- The SwiftUI `OptimizedEntry` already has an `onReceive(client.$isPreviewPanelOpen)` handler that
  snapshots `lockedPersonalizations` when the panel closes. With the fix, a section that had
  `liveUpdates: false` and was forced live by the panel will, on panel close, fall back to
  `lockedPersonalizations`. Confirm that the snapshot taken in that handler is the value the locked
  section should freeze on after a preview session — it appears correct (the handler stores
  `client.selectedPersonalizations` while `isLocked`), but exercise a panel open/identify/close
  cycle to be sure the locked section settles on a defined value rather than reverting to a stale
  pre-panel snapshot.
- The UIKit `subscribeToPreviewPanel` handler uses `.dropFirst()`; verify the locked section still
  rebuilds correctly on the first panel-open event after this change (the toggle path calls
  `rebuildSections()` via `refreshUI()`, so the section is recreated, which sidesteps the
  `dropFirst` concern — but worth a manual check).
- This change only touches `shouldLiveUpdate`; `effectivePersonalizations`, locking state, and the
  subscription logic are unchanged, so the blast radius is small.

## Related files

- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift` —
  SwiftUI `shouldLiveUpdate` (primary fix).
- `implementations/ios-sdk/uikit/Components/OptimizedEntryUIView.swift` — UIKit `shouldLiveUpdate`
  (parallel fix).
- `implementations/ios-sdk/swiftui/Screens/LiveUpdatesTestScreen.swift` — SwiftUI test screen;
  preview-panel button wiring (already correct).
- `implementations/ios-sdk/uikit/Screens/LiveUpdatesTestViewController.swift` — UIKit test screen;
  preview-panel button wiring (already correct).
- `implementations/ios-sdk/uitests/Tests/LiveUpdatesTests.swift` — failing test plus the
  locked/global regression tests that must keep passing.
- `packages/react-native-sdk/src/components/OptimizedEntry.tsx` — canonical `shouldLiveUpdate`
  precedence.
- `packages/web/frameworks/react-web-sdk/src/optimized-entry/useOptimizedEntry.ts` and
  `optimizedEntryUtils.ts` — `resolveShouldLiveUpdate` reference.
- `implementations/react-native-sdk/e2e/live-updates-pseudocode.md` — cross-platform contract for
  the live-updates tests.
