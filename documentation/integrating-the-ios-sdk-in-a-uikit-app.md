# Integrating the Optimization iOS SDK in a UIKit App

Use this guide when you want to add personalization and analytics to a UIKit application using the
Contentful Optimization iOS SDK.

This guide assumes familiarity with the shared concepts covered in
[iOS SDK Fundamentals](./integrating-the-ios-sdk-fundamentals.md) — installation, configuration,
consent, reactive state, the tracking model, live updates, and the preview panel. Read that first if
you have not already.

Use the SwiftUI guide instead if your app is SwiftUI-based:
[Integrating the Optimization iOS SDK in a SwiftUI App](./integrating-the-ios-sdk-in-a-swiftui-app.md).

## Scope And Capabilities

The UIKit integration is more explicit than the SwiftUI one: the SDK does not ship UIKit-native
views equivalent to `OptimizedEntry` or `OptimizationScrollView`. Instead, you work with
`OptimizationClient` directly and attach tracking yourself.

UIKit apps typically use:

- `OptimizationClient` as a long-lived property on the `SceneDelegate`, passed down into view
  controllers.
- `client.personalizeEntry(baseline:personalizations:)` called in cell configuration or view
  controller setup.
- `client.trackView(_:)` and `client.trackClick(_:)` called from visibility callbacks and
  `UIControl` actions.
- `client.screen(name:)` called from `viewDidAppear(_:)`.
- `PreviewPanelViewController` (a `UIHostingController` subclass) mounted behind
  `PreviewPanelViewController.addFloatingButton(to:client:contentfulClient:)` for developer
  overrides.

The preview panel's UI is itself SwiftUI, but `PreviewPanelViewController` wraps it in a
`UIHostingController` so it drops cleanly into a UIKit navigation stack.

## Reference App

See the UIKit demo at
[Colorful-Team-Org/OptimizationiOSSDKDemo — UIKitDemo](https://github.com/Colorful-Team-Org/OptimizationiOSSDKDemo)
(local checkout at
[`../../optimization-ios-demo/UIKitDemo`](../../optimization-ios-demo/UIKitDemo)). It is
functionally identical to the SwiftUI demo so you can compare side-by-side.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Scope And Capabilities](#scope-and-capabilities)
- [The Integration Flow](#the-integration-flow)
- [1. Initialize In SceneDelegate](#1-initialize-in-scenedelegate)
- [2. Handle Consent](#2-handle-consent)
- [3. Personalize Entries](#3-personalize-entries)
  - [Calling personalizeEntry](#calling-personalizeentry)
  - [Reloading On selectedPersonalizations Changes](#reloading-on-selectedpersonalizations-changes)
  - [Live Updates vs Locked Variants](#live-updates-vs-locked-variants)
- [4. Track Entry Interactions](#4-track-entry-interactions)
  - [Click Tracking](#click-tracking)
  - [View Tracking](#view-tracking)
- [5. Track Screen Views](#5-track-screen-views)
- [6. Preview Panel](#6-preview-panel)
- [A Complete Example](#a-complete-example)

<!-- mtoc-end -->
</details>

## The Integration Flow

A typical UIKit integration is:

1. Install the SDK and build an `OptimizationConfig`.
2. Create a shared `OptimizationClient` in `SceneDelegate` and call `initialize(config:)`.
3. Collect consent (or pre-grant it for demos).
4. Pass the client into root view controllers.
5. Fetch Contentful entries with `include: 10`.
6. In cell configuration, call `client.personalizeEntry(baseline:personalizations:)` and render the
   resolved entry.
7. Track clicks from `UIControl` actions with `TrackClickPayload`; track views by reporting visible
   duration to `TrackViewPayload`.
8. Call `client.screen(name:)` from `viewDidAppear(_:)`.
9. Mount the preview panel behind a debug flag with
   `PreviewPanelViewController.addFloatingButton(...)`.

## 1. Initialize In SceneDelegate

Own the `OptimizationClient` from `SceneDelegate` so its lifetime matches the scene and its instance
is easy to pass into view controllers.

```swift
import ContentfulOptimization
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    let client = OptimizationClient()
    let contentfulClient = ContentfulHTTPPreviewClient(
        spaceId: AppConfig.contentfulSpaceId,
        accessToken: AppConfig.contentfulAccessToken,
        environment: AppConfig.contentfulEnvironment
    )

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        try? client.initialize(config: OptimizationConfig(
            clientId: AppConfig.optimizationClientId,
            environment: AppConfig.optimizationEnvironment,
            defaults: StorageDefaults(consent: true), // demo pre-grant
            debug: true
        ))

        let home = HomeViewController(client: client)
        let nav = UINavigationController(rootViewController: home)

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = nav
        window?.makeKeyAndVisible()
    }
}
```

> [!IMPORTANT]
>
> `OptimizationClient` is `@MainActor`, so `initialize(config:)` must be called on the main thread.
> `scene(_:willConnectTo:options:)` already runs on the main thread, so the call above is safe.

Pass `client` into each view controller's initializer. This gives every screen access to the
singleton instance for calling `personalizeEntry`, tracking events, and observing
`selectedPersonalizations`.

## 2. Handle Consent

See [Consent](./integrating-the-ios-sdk-fundamentals.md#consent) in the fundamentals for the consent
model. In UIKit, typical patterns are:

- A dedicated consent view controller shown before the main navigation stack.
- An inline banner pushed into the first screen.
- A pre-grant via `StorageDefaults(consent: true)` for demos.

Example consent actions:

```swift
@objc private func acceptTapped() { client.consent(true) }
@objc private func rejectTapped() { client.consent(false) }
```

To observe the consent state reactively, subscribe to `client.$state`:

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

## 3. Personalize Entries

### Calling personalizeEntry

Fetch Contentful entries into `[String: Any]` dictionaries (the demo app's `ContentfulService` uses
raw `URLSession`; any JSON-returning Contentful client works). Call
`personalizeEntry(baseline:personalizations:)` wherever you render the entry — typically in
`tableView(_:cellForRowAt:)`:

```swift
func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(
        withIdentifier: BlogPostCardCell.reuseIdentifier,
        for: indexPath
    ) as! BlogPostCardCell

    let baseline = posts[indexPath.row]
    let resolved = client.personalizeEntry(
        baseline: baseline,
        personalizations: client.selectedPersonalizations
    )
    cell.configure(with: resolved.entry)
    return cell
}
```

`personalizeEntry` is synchronous and returns a `PersonalizedResult`:

| Field             | Type             | Description                                                      |
| ----------------- | ---------------- | ---------------------------------------------------------------- |
| `entry`           | `[String: Any]`  | The resolved variant entry (or the baseline if nothing matched). |
| `personalization` | `[String: Any]?` | The matched personalization metadata, or `nil` when baseline.    |

Use `personalization != nil` to decide whether a user saw a personalized variant — useful when
composing tracking payloads.

### Reloading On selectedPersonalizations Changes

When `client.selectedPersonalizations` changes (for example, after the user's audience qualification
shifts), re-resolve and redraw affected cells. Observe the property via Combine:

```swift
client.$selectedPersonalizations
    .dropFirst()
    .receive(on: RunLoop.main)
    .sink { [weak self] _ in
        guard let self else { return }
        self.tableView.reloadData()
    }
    .store(in: &cancellables)
```

### Live Updates vs Locked Variants

UIKit does not have an automatic "lock to first variant" mechanism — you decide when to re-resolve
based on whether you want to stay locked or update live. Two common patterns:

- **Live updates**: call `personalizeEntry` inside `cellForRowAt` and reload the table when
  `selectedPersonalizations` changes (as above). The user sees the current best variant.
- **Locked variants**: capture `client.selectedPersonalizations` at the time your screen loads,
  store it in the view controller, and pass that snapshot into every `personalizeEntry` call. Do not
  reload on change.

A common compromise is to live-update while the preview panel is open (for developer feedback) and
lock in production. You can check `client.isPreviewPanelOpen` to decide.

## 4. Track Entry Interactions

### Click Tracking

Wire up a tap action on the control and call `client.trackClick(_:)` with a `TrackClickPayload`:

```swift
ctaView.onButtonTap = { [weak self] in
    guard let self else { return }
    let sys = cta["sys"] as? [String: Any] ?? [:]
    let componentId = sys["id"] as? String ?? ""
    Task {
        try? await self.client.trackClick(TrackClickPayload(
            componentId: componentId,
            variantIndex: resolved.personalization != nil ? 1 : 0
        ))
    }
}
```

`TrackClickPayload` fields:

| Field          | Type      | Description                                        |
| -------------- | --------- | -------------------------------------------------- |
| `componentId`  | `String`  | Typically `entry.sys.id`.                          |
| `experienceId` | `String?` | The ID of the matching experience, if any.         |
| `variantIndex` | `Int`     | `0` for baseline; `1+` for a personalized variant. |

### View Tracking

UIKit does not have a visibility modifier, so you detect visibility yourself (e.g. via
`collectionView(_:willDisplay:forItemAt:)` / `didEndDisplaying` or by observing cell visibility
changes) and call `client.trackView(_:)` with a `TrackViewPayload`:

```swift
try? await client.trackView(TrackViewPayload(
    componentId: entryId,
    viewId: UUID().uuidString,
    experienceId: experienceId,
    variantIndex: variantIndex,
    viewDurationMs: durationMs,
    sticky: nil
))
```

Strategy for computing `viewDurationMs`:

1. In `willDisplay`, record the timestamp and start a periodic timer.
2. On each timer tick (e.g. every 5 seconds), send a `TrackViewPayload` with the running duration.
3. In `didEndDisplaying`, send a final payload and cancel the timer.

If this level of visibility accounting is more than you need, the simpler path is to send one event
per display with a short configurable duration. The SwiftUI `OptimizedEntry` uses the
threshold-based algorithm described in the fundamentals; UIKit apps that want parity can port that
logic or read `ViewTrackingController` in the SDK source as a reference.

## 5. Track Screen Views

Call `client.screen(name:)` from `viewDidAppear(_:)`:

```swift
override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { try? await client.screen(name: "Home") }
}
```

`screen` is async and throws, which is why it runs inside a `Task`. Use `try?` to silence errors
unless you need to handle them.

To include extra properties:

```swift
Task {
    try? await client.screen(
        name: "BlogPostDetail",
        properties: ["postId": postId]
    )
}
```

## 6. Preview Panel

Attach the floating action button in the scene delegate (or from a root view controller's
`viewDidLoad`), gated on a debug flag:

```swift
#if DEBUG
PreviewPanelViewController.addFloatingButton(
    to: homeVC,
    client: client,
    contentfulClient: contentfulClient
)
#endif
```

`addFloatingButton(to:client:contentfulClient:)` adds a pinned button in the bottom-trailing corner
of the host view controller and wires it up to present `PreviewPanelViewController` on tap. The
preview panel's UI is SwiftUI wrapped in a `UIHostingController`, so it lives happily inside a UIKit
navigation stack.

While the panel is open, `client.isPreviewPanelOpen` is `true`. `PreviewPanelViewController` updates
this for you in `viewDidAppear` / `viewWillDisappear`. Use it to decide whether to re-resolve
entries live:

```swift
client.$isPreviewPanelOpen
    .receive(on: RunLoop.main)
    .sink { [weak self] _ in self?.tableView.reloadData() }
    .store(in: &cancellables)
```

The `contentfulClient` parameter is optional — without it the panel displays audiences and
experiences by ID. Passing `ContentfulHTTPPreviewClient` enables rich names, variant labels, and
traffic percentages. You can also implement `PreviewContentfulClient` directly if you already have a
Contentful client you want to reuse.

## A Complete Example

The UIKit demo's scene delegate and home view controller together show the full pattern — SDK init
in `scene(_:willConnectTo:options:)`, a `UITableView` that calls `personalizeEntry` in
`cellForRowAt`, click tracking on the CTA button, screen tracking in `viewDidAppear`, and the
preview panel FAB attached behind `debug: true`:

```swift
// UIKitDemo/UIKitDemo/SceneDelegate.swift
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    let client = OptimizationClient()
    let contentfulClient = ContentfulHTTPPreviewClient(
        spaceId: AppConfig.contentfulSpaceId,
        accessToken: AppConfig.contentfulAccessToken,
        environment: AppConfig.contentfulEnvironment
    )

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        try? client.initialize(config: OptimizationConfig(
            clientId: AppConfig.optimizationClientId,
            environment: AppConfig.optimizationEnvironment,
            defaults: StorageDefaults(consent: true),
            debug: true
        ))

        let homeVC = HomeViewController(client: client)
        let nav = UINavigationController(rootViewController: homeVC)

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = nav
        window?.makeKeyAndVisible()

        PreviewPanelViewController.addFloatingButton(
            to: homeVC,
            client: client,
            contentfulClient: contentfulClient
        )
    }
}
```

```swift
// UIKitDemo/UIKitDemo/Screens/HomeViewController.swift (excerpt)
final class HomeViewController: UIViewController {
    private let client: OptimizationClient
    private let tableView = UITableView(frame: .zero, style: .grouped)
    private var cancellables = Set<AnyCancellable>()

    override func viewDidLoad() {
        super.viewDidLoad()
        // ... setup ...
        client.$selectedPersonalizations
            .dropFirst()
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.tableView.reloadData() }
            .store(in: &cancellables)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { try? await client.screen(name: "Home") }
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(/* ... */) as! BlogPostCardCell
        let resolved = client.personalizeEntry(
            baseline: posts[indexPath.row],
            personalizations: client.selectedPersonalizations
        )
        cell.configure(with: resolved.entry)
        return cell
    }
}
```

Clone the demo repo, run `./scripts/setup.sh`, and open `UIKitDemo.xcworkspace` to step through the
rest of the code alongside the SDK sources.
