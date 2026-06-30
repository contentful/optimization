import SwiftUI

/// Top-level view that initializes the ``OptimizationClient`` and injects it into the SwiftUI environment.
///
/// Wrap your app content in this view to provide the optimization client and tracking configuration
/// to all descendant ``OptimizedEntry`` components.
/// Entry view and tap tracking default to enabled; pass `trackViews: false` or `trackTaps: false`
/// to opt out globally.
///
/// ```swift
/// OptimizationRoot(config: OptimizationConfig(clientId: "my-id")) {
///     ContentView()
/// }
/// ```
///
/// Pass a ``PreviewPanelConfig`` to add the debug preview panel without manually wrapping
/// content in ``PreviewPanelOverlay``:
///
/// ```swift
/// OptimizationRoot(
///     config: OptimizationConfig(clientId: "my-id"),
///     previewPanel: PreviewPanelConfig(contentfulClient: myContentfulClient)
/// ) {
///     ContentView()
/// }
/// ```
public struct OptimizationRoot<Content: View>: View {
    let config: OptimizationConfig
    let trackViews: Bool
    let trackTaps: Bool
    let liveUpdates: Bool
    let previewPanel: PreviewPanelConfig?
    @ViewBuilder let content: () -> Content

    @StateObject private var client = OptimizationClient()

    public init(
        config: OptimizationConfig,
        trackViews: Bool = true,
        trackTaps: Bool = true,
        liveUpdates: Bool = false,
        previewPanel: PreviewPanelConfig? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.config = config
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.liveUpdates = liveUpdates
        self.previewPanel = previewPanel
        self.content = content
    }

    public var body: some View {
        Group {
            if client.isInitialized {
                appContent
            } else {
                ProgressView()
            }
        }
        .environmentObject(client)
        .environment(\.trackingConfig, TrackingConfig(
            trackViews: trackViews,
            trackTaps: trackTaps,
            liveUpdates: liveUpdates
        ))
        .task {
            try? client.initialize(config: config)
        }
    }

    /// App content, optionally wrapped in ``PreviewPanelOverlay`` when a
    /// ``PreviewPanelConfig`` with `enabled == true` is provided.
    @ViewBuilder
    private var appContent: some View {
        if let previewPanel = previewPanel, previewPanel.enabled {
            PreviewPanelOverlay(contentfulClient: previewPanel.contentfulClient) {
                content()
            }
        } else {
            content()
        }
    }
}
