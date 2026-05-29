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
- The mock server running on `localhost:8000` with `adb reverse tcp:8000 tcp:8000` (the demo apps
  point at `http://localhost:8000` via `AppConfig`).

Locally, use `scripts/run-maestro-e2e.sh` (see `implementations/android-sdk/scripts/`), which wires
up the mock server, port forwarding, and runs the flows against both apps.

## Status

PoC scope: `PreviewPanelTests` only. The UiAutomator `uitests` module is retained in the tree but
its CI run job is disabled while we measure Maestro's reliability. See the repository plan and
`uitests/README.md` for the migration context.
