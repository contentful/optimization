# Maestro E2E flows (preview-panel proof-of-concept)

These [Maestro](https://maestro.dev) flows are a proof-of-concept replacement for the flakiest
UiAutomator suite, `uitests/.../tests/PreviewPanelTests.kt`. They exist to evaluate whether
Maestro's built-in auto-waiting and `scrollUntilVisible` eliminate the timing flakiness inherent to
the black-box UiAutomator polling harness, while keeping a **single flow set that drives both
reference apps**.

## Single bundle, both APKs

Every flow declares `appId: ${APP_ID}`. The same flows run against both apps by passing the package
at runtime — mirroring the iOS paradigm of one test bundle across the SwiftUI and UIKit targets:

```sh
maestro test -e APP_ID=com.contentful.optimization.app maestro/preview-panel        # Compose
maestro test -e APP_ID=com.contentful.optimization.app.views maestro/preview-panel  # XML Views
```

This works because both apps expose the same identifiers: the preview-panel elements come from the
shared `PreviewPanelContent` composable (Android `contentDescription`, matched by Maestro's text
selector), and `identify-button` / `reset-button` are exposed as resource-ids (matched by Maestro's
`id:` selector) in both apps.

## Prerequisites

- A running Android emulator/device (the flows assume the demo app is installed).
- The mock server running on the host at port `8000`. The demo apps reach it via the emulator host
  alias `http://10.0.2.2:8000` (`AppConfig.mockHost`), which needs no `adb reverse` and survives the
  adb-daemon restarts that silently wipe reverse forwards on loaded CI emulators.

Locally, run `pnpm test:e2e` (or `pnpm test:e2e:compose` / `pnpm test:e2e:views`), which uses
`scripts/run-e2e.sh` to manage the emulator, mock server, and port forwarding, then runs the flows
against both apps. Pass `--flow <suite>` (e.g. `preview-panel`) to run a single suite.

## Status

Maestro is now the canonical Android E2E suite — the entire UiAutomator suite (`ScreenTracking`,
`TapTracking`, `OfflineBehavior`, `Identified`/`UnidentifiedVariants`, `LiveUpdates`,
`PreviewPanel`, `PreviewPanelOverrides`) has been ported here and the UiAutomator CI run job has
been removed. The dwell/view-tracking contract intentionally stays out of E2E — it is owned by
`ViewTrackingControllerTest` (JVM unit) and the iOS XCUITest suite. The `uitests/` module source is
retained for now pending its removal in a follow-up.
