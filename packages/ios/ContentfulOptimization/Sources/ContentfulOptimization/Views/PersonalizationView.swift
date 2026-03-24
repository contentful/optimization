import Combine
import SwiftUI

/// Resolves the personalized variant of an entry and renders content via a ViewBuilder.
///
/// By default, locks to the first resolved variant to prevent UI flashing.
/// Set `liveUpdates: true` to always use the latest variant.
///
/// ```swift
/// PersonalizationView(baselineEntry: entry) { resolvedEntry in
///     Text(resolvedEntry["title"] as? String ?? "")
/// }
/// ```
public struct PersonalizationView<Content: View>: View {
    let baselineEntry: [String: Any]
    let viewTimeMs: Int
    let threshold: Double
    let viewDurationUpdateIntervalMs: Int
    let liveUpdates: Bool?
    let trackViews: Bool?
    let trackTaps: Bool?
    let accessibilityIdentifier: String?
    let onTap: (([String: Any]) -> Void)?
    @ViewBuilder let content: ([String: Any]) -> Content

    @EnvironmentObject private var client: OptimizationClient
    @Environment(\.trackingConfig) private var trackingConfig

    // Variant locking state
    @State private var lockedPersonalizations: [[String: Any]]?
    @State private var isLocked: Bool = false

    public init(
        baselineEntry: [String: Any],
        viewTimeMs: Int = 2000,
        threshold: Double = 0.8,
        viewDurationUpdateIntervalMs: Int = 5000,
        liveUpdates: Bool? = nil,
        trackViews: Bool? = nil,
        trackTaps: Bool? = nil,
        accessibilityIdentifier: String? = nil,
        onTap: (([String: Any]) -> Void)? = nil,
        @ViewBuilder content: @escaping ([String: Any]) -> Content
    ) {
        self.baselineEntry = baselineEntry
        self.viewTimeMs = viewTimeMs
        self.threshold = threshold
        self.viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs
        self.liveUpdates = liveUpdates
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.accessibilityIdentifier = accessibilityIdentifier
        self.onTap = onTap
        self.content = content
    }

    private var shouldLiveUpdate: Bool {
        liveUpdates ?? trackingConfig.liveUpdates
    }

    private var effectivePersonalizations: [[String: Any]]? {
        shouldLiveUpdate ? client.selectedPersonalizations : lockedPersonalizations
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
        let result = client.personalizeEntry(
            baseline: baselineEntry,
            personalizations: effectivePersonalizations
        )
        content(result.entry)
            .modifier(ViewTrackingModifier(
                entry: baselineEntry,
                personalization: result.personalization,
                threshold: threshold,
                viewTimeMs: viewTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs,
                enabled: viewsEnabled,
                client: client
            ))
            .modifier(TapTrackingModifier(
                entry: baselineEntry,
                personalization: result.personalization,
                enabled: tapsEnabled,
                onTap: onTap,
                client: client
            ))
            .accessibilityIdentifier(accessibilityIdentifier ?? "")
            .onReceive(client.$selectedPersonalizations) { newValue in
                guard !shouldLiveUpdate, !isLocked, newValue != nil else { return }
                lockedPersonalizations = newValue
                isLocked = true
            }
    }
}
