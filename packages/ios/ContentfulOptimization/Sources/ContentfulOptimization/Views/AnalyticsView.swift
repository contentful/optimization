import SwiftUI

/// Provides view and tap tracking for non-personalized entries.
///
/// Unlike ``PersonalizationView``, this view does not resolve personalization variants.
/// It passes the entry directly to the content builder.
///
/// ```swift
/// AnalyticsView(entry: myEntry) { entry in
///     Text(entry["title"] as? String ?? "")
/// }
/// ```
public struct AnalyticsView<Content: View>: View {
    let entry: [String: Any]
    let viewTimeMs: Int
    let threshold: Double
    let viewDurationUpdateIntervalMs: Int
    let trackViews: Bool?
    let trackTaps: Bool?
    let accessibilityIdentifier: String?
    let onTap: (([String: Any]) -> Void)?
    @ViewBuilder let content: ([String: Any]) -> Content

    @EnvironmentObject private var client: OptimizationClient
    @Environment(\.trackingConfig) private var trackingConfig

    public init(
        entry: [String: Any],
        viewTimeMs: Int = 2000,
        threshold: Double = 0.8,
        viewDurationUpdateIntervalMs: Int = 5000,
        trackViews: Bool? = nil,
        trackTaps: Bool? = nil,
        accessibilityIdentifier: String? = nil,
        onTap: (([String: Any]) -> Void)? = nil,
        @ViewBuilder content: @escaping ([String: Any]) -> Content
    ) {
        self.entry = entry
        self.viewTimeMs = viewTimeMs
        self.threshold = threshold
        self.viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.accessibilityIdentifier = accessibilityIdentifier
        self.onTap = onTap
        self.content = content
    }

    private var viewsEnabled: Bool {
        trackViews ?? trackingConfig.trackViews
    }

    private var tapsEnabled: Bool {
        if trackTaps == false { return false }
        if trackTaps != nil || onTap != nil { return true }
        return trackingConfig.trackTaps
    }

    public var body: some View {
        content(entry)
            .modifier(ViewTrackingModifier(
                entry: entry,
                personalization: nil,
                threshold: threshold,
                viewTimeMs: viewTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs,
                enabled: viewsEnabled,
                client: client
            ))
            .modifier(TapTrackingModifier(
                entry: entry,
                personalization: nil,
                enabled: tapsEnabled,
                onTap: onTap,
                client: client
            ))
            .accessibilityIdentifier(accessibilityIdentifier ?? "")
    }
}
