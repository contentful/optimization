import SwiftUI

/// Top-level view that initializes the ``OptimizationClient`` and injects it into the SwiftUI environment.
///
/// Wrap your app content in this view to provide the optimization client and tracking configuration
/// to all descendant ``PersonalizationView`` and ``AnalyticsView`` components.
///
/// ```swift
/// OptimizationRoot(config: OptimizationConfig(clientId: "my-id")) {
///     ContentView()
/// }
/// ```
public struct OptimizationRoot<Content: View>: View {
    let config: OptimizationConfig
    let trackViews: Bool
    let trackTaps: Bool
    let liveUpdates: Bool
    @ViewBuilder let content: () -> Content

    @StateObject private var client = OptimizationClient()

    public init(
        config: OptimizationConfig,
        trackViews: Bool = true,
        trackTaps: Bool = false,
        liveUpdates: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.config = config
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.liveUpdates = liveUpdates
        self.content = content
    }

    public var body: some View {
        Group {
            if client.isInitialized {
                content()
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
}
