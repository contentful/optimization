# Integrating the Optimization iOS SDK in a UIKit app

Use this guide when you want to add Personalization, Analytics, screen tracking, and preview
overrides to a UIKit application using the Optimization iOS SDK.

For shared runtime behavior, consent gates, tracking thresholds, live-update precedence, and offline
delivery, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md).
For cross-SDK consent policy guidance, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).
Use the SwiftUI guide instead if your app is SwiftUI-based:
[Integrating the Optimization iOS SDK in a SwiftUI app](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope and capabilities](#scope-and-capabilities)
- [The integration flow](#the-integration-flow)
- [1. Add the package and create the config](#1-add-the-package-and-create-the-config)
- [2. Initialize in SceneDelegate](#2-initialize-in-scenedelegate)
- [3. Handle consent](#3-handle-consent)
- [4. Personalize entries](#4-personalize-entries)
  - [Resolve entries in view code](#resolve-entries-in-view-code)
  - [React to selected personalization changes](#react-to-selected-personalization-changes)
- [5. Track entry interactions](#5-track-entry-interactions)
  - [Track taps](#track-taps)
  - [Track views](#track-views)
- [6. Track screen views](#6-track-screen-views)
- [Live updates](#live-updates)
- [Preview panel](#preview-panel)
- [Complete example](#complete-example)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Scope and capabilities

The UIKit integration uses `OptimizationClient` directly. The SDK does not provide UIKit-native view
equivalents for `OptimizedEntry` or `OptimizationScrollView`, so the application decides where to
resolve entries and when to emit interaction tracking.

UIKit apps typically use:

- `OptimizationClient` as a long-lived object owned by `SceneDelegate` or an app-level coordinator.
- `client.personalizeEntry(baseline:personalizations:)` during cell or view configuration.
- `client.trackView(_:)` and `client.trackClick(_:)` from visibility callbacks and control actions.
- `client.screen(name:)` from view-controller lifecycle methods.
- `PreviewPanelViewController` behind a debug or internal-build flag.

The SDK does not replace your Contentful delivery client. Your application still owns Contentful
fetching, consent UX, identity policy, navigation, and rendering.

## The integration flow

Most UIKit integrations follow this sequence:

1. Add the Swift Package and create an `OptimizationConfig`.
2. Create a shared `OptimizationClient` and call `initialize(config:)`.
3. Apply the application's consent policy: seed consent when default-on SDK activity is permitted,
   or collect consent in app UI.
4. Pass the client into the view controllers that render Contentful content.
5. Fetch Contentful entries with linked optimization references.
6. Resolve entries in cell or view configuration with
   `client.personalizeEntry(baseline:personalizations:)`.
7. Track taps from controls and track views from visibility-duration logic.
8. Emit screen events from view-controller lifecycle methods.

Optional additions include live-update redraws when selected personalizations change, and the
preview panel when authors or engineers need local audience and variant overrides.

The iOS reference implementation in this repository demonstrates the same SDK behavior in SwiftUI
and UIKit shells:

- [iOS reference implementation](../../implementations/ios-sdk/README.md)

## 1. Add the package and create the config

Add `ContentfulOptimization` through Swift Package Manager as described in the
[Optimization iOS SDK README](../../packages/ios/ContentfulOptimization/README.md). Then create an
`OptimizationConfig` with the Optimization client ID and the Contentful locale information your app
uses when fetching entries:

```swift
let config = OptimizationConfig(
    clientId: "your-client-id",
    environment: "master",
    contentfulLocales: ContentfulLocales(default: "en-US"),
    locale: "en-US",
    debug: true
)
```

Only `clientId` is required. If application policy permits Optimization by default and no end-user
consent UI is rendered, set `defaults: StorageDefaults(consent: true)`. Otherwise, leave defaults
unset and connect `client.consent(true)` and `client.consent(false)` to the app's consent UI.

Use `contentfulLocales` and `locale` when the same screen renders localized Contentful entries. For
the full locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

## 2. Initialize in SceneDelegate

Own the `OptimizationClient` from `SceneDelegate` when the client lifetime needs to match the scene.
Pass that same instance into the root view controller and any child controller that resolves entries
or tracks events.

```swift
import ContentfulOptimization
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    let client = OptimizationClient()

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        try? client.initialize(config: config)

        let home = HomeViewController(client: client)
        let navigation = UINavigationController(rootViewController: home)

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = navigation
        window?.makeKeyAndVisible()
    }
}
```

`OptimizationClient` is `@MainActor`. View-controller lifecycle methods already run on the main
thread, but asynchronous callbacks that call the client must return to the main actor first. For
lifecycle details, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#lifecycle-and-main-actor).

## 3. Handle consent

If your application policy permits Optimization by default, seed accepted consent in
`OptimizationConfig` and omit consent controls:

```swift
let config = OptimizationConfig(
    clientId: "your-client-id",
    defaults: StorageDefaults(consent: true)
)
```

That starts all gated SDK events immediately and permits durable profile-continuity storage for
profile, selected optimizations, changes, and the anonymous ID.

When application policy depends on user choice, leave consent unset and connect the app's consent
controls to the client. `identify` and `screen` remain allowed before consent so a mobile journey
can establish profile context and anonymous screen analytics.

```swift
@objc private func acceptTapped() {
    client.consent(true)
}

@objc private func rejectTapped() {
    client.consent(false)
}
```

To react to consent changes, subscribe to `client.$state`:

```swift
client.$state
    .map(\.consent)
    .removeDuplicates()
    .receive(on: RunLoop.main)
    .sink { [weak self] value in
        self?.updateConsentUI(value)
    }
    .store(in: &cancellables)
```

Boolean consent updates both event emission and durable profile-continuity persistence by default.
If your policy allows events but not durable continuity, call
`client.consent(events: true, persistence: false)` and observe `client.state.persistenceConsent` or
`client.$state.map(\.persistenceConsent)` when the UI needs to show that separate state.

When durable profile-continuity persistence is allowed, SDK state from an Experience response is
published only after the corresponding storage write has settled. Wait for SDK-derived state instead
of adding sleeps before relaunching or terminating the app in tests.

## 4. Personalize entries

### Resolve entries in view code

Fetch entries from Contentful as single-locale JSON-shaped dictionaries and include linked
optimization references in the payload. Then resolve each entry where the UIKit view configures its
content:

```swift
func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(
        withIdentifier: BlogPostCardCell.reuseIdentifier,
        for: indexPath
    ) as! BlogPostCardCell

    let resolved = client.personalizeEntry(
        baseline: posts[indexPath.row],
        personalizations: client.selectedPersonalizations
    )

    cell.configure(with: resolved.entry)
    return cell
}
```

`personalizeEntry` is synchronous. It returns the baseline entry unchanged when the SDK has no
matching selected personalization, when the entry has no optimization references, or when the linked
variant data is not present in the Contentful payload. For details, see
[Entry personalization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md).

### React to selected personalization changes

When `client.selectedPersonalizations` changes, the app decides whether visible UIKit views need to
re-resolve entries. A table or collection view can redraw affected cells:

```swift
client.$selectedPersonalizations
    .dropFirst()
    .receive(on: RunLoop.main)
    .sink { [weak self] _ in
        self?.tableView.reloadData()
    }
    .store(in: &cancellables)
```

For locked content, capture `client.selectedPersonalizations` when the screen loads and pass that
snapshot into each `personalizeEntry` call.

## 5. Track entry interactions

### Track taps

Emit tap events from `UIControl` actions or gesture handlers:

```swift
ctaView.onButtonTap = { [weak self] in
    guard let self else { return }

    Task { @MainActor in
        try? await self.client.trackClick(TrackClickPayload(
            componentId: ctaEntryId,
            experienceId: experienceId,
            variantIndex: variantIndex
        ))
    }
}
```

Use `entry.sys.id` as `componentId`. Set `variantIndex` to `0` for the baseline entry and to the
selected variant index when `personalizeEntry` returns personalization metadata.

### Track views

UIKit apps compute visibility and duration in application code, then send a `TrackViewPayload`:

```swift
Task { @MainActor in
    try? await client.trackView(TrackViewPayload(
        componentId: entryId,
        viewId: viewId,
        experienceId: experienceId,
        variantIndex: variantIndex,
        viewDurationMs: durationMs,
        sticky: nil
    ))
}
```

A common table or collection view pattern is:

1. Record a timestamp when a cell becomes visible.
2. Emit periodic duration updates while it remains visible.
3. Emit a final duration update when it stops being visible.

For the default SwiftUI thresholds and shared event-delivery behavior, see
[iOS SDK runtime and interaction mechanics](../concepts/ios-sdk-runtime-and-interaction-mechanics.md#tracking-mechanics).

## 6. Track screen views

Call `client.screen(name:)` from `viewDidAppear(_:)`:

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)

    Task { @MainActor in
        try? await client.screen(name: "Home")
    }
}
```

Include properties when the screen name needs additional context:

```swift
Task { @MainActor in
    try? await client.screen(
        name: "BlogPostDetail",
        properties: ["postId": postId]
    )
}
```

## Live updates

UIKit does not lock or re-resolve entries automatically. The app chooses between two patterns:

- **Live updates** - Resolve entries during cell or view configuration and redraw when
  `selectedPersonalizations` changes.
- **Locked variants** - Capture selected personalizations when the screen loads and keep resolving
  against that snapshot.

The preview panel sets `client.isPreviewPanelOpen` while it is visible. Use that value when the app
needs to redraw in live mode for preview sessions and keep production screens locked.

## Preview panel

Gate the preview panel behind a debug or internal-build flag. `PreviewPanelViewController` adds a
floating button to a host view controller and presents the panel when tapped.

```swift
#if DEBUG
PreviewPanelViewController.addFloatingButton(
    to: home,
    client: client,
    contentfulClient: contentfulClient
)
#endif
```

The `contentfulClient` parameter is optional. Passing a `PreviewContentfulClient` enables audience
and experience names in the panel; without it, the panel displays identifiers.

The preview panel's UI is SwiftUI wrapped for UIKit, so it can be presented from a UIKit navigation
stack without changing the rest of the app.

## Complete example

This example combines scene-level initialization, entry resolution in table-cell configuration,
screen tracking, selected-personalization redraws, and preview-panel mounting:

```swift
final class HomeViewController: UIViewController {
    private let client: OptimizationClient
    private var posts: [[String: Any]] = []
    private var cancellables = Set<AnyCancellable>()

    init(client: OptimizationClient) {
        self.client = client
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        client.$selectedPersonalizations
            .dropFirst()
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.tableView.reloadData() }
            .store(in: &cancellables)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        Task { @MainActor in
            try? await client.screen(name: "Home")
        }
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(
            withIdentifier: BlogPostCardCell.reuseIdentifier,
            for: indexPath
        ) as! BlogPostCardCell

        let resolved = client.personalizeEntry(
            baseline: posts[indexPath.row],
            personalizations: client.selectedPersonalizations
        )

        cell.configure(with: resolved.entry)
        return cell
    }
}
```

## Reference implementations to compare against

- [iOS reference implementation](../../implementations/ios-sdk/README.md) - Demonstrates SwiftUI and
  UIKit shells that exercise shared native iOS bridge behavior, entry resolution, interaction
  tracking, screen tracking, and preview-panel overrides against the same mock API.
