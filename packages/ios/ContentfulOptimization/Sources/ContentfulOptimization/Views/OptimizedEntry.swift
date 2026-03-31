import Combine
import SwiftUI

/// Unified component for tracking and personalizing Contentful entries.
///
/// Handles both personalized entries (with `nt_experiences`) and non-personalized
/// entries. For personalized entries, it resolves the correct variant based on the
/// user's profile. For all entries, it tracks views and taps.
///
/// By default, locks to the first resolved variant to prevent UI flashing.
/// Set `liveUpdates: true` to always use the latest variant.
///
/// ```swift
/// OptimizedEntry(entry: myEntry) { resolvedEntry in
///     Text(resolvedEntry["title"] as? String ?? "")
/// }
/// ```
public struct OptimizedEntry<Content: View>: View {
    let entry: [String: Any]
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

    // Variant locking state (only used for personalized entries)
    @State private var lockedPersonalizations: [[String: Any]]?
    @State private var isLocked: Bool = false

    public init(
        entry: [String: Any],
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
        self.entry = entry
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

    private var isPersonalized: Bool {
        guard let fields = entry["fields"] as? [String: Any] else { return false }
        return fields["nt_experiences"] != nil
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
        let result: PersonalizedResult = {
            if isPersonalized {
                return client.personalizeEntry(
                    baseline: entry,
                    personalizations: effectivePersonalizations
                )
            } else {
                return PersonalizedResult(entry: entry, personalization: nil)
            }
        }()

        content(result.entry)
            .modifier(ViewTrackingModifier(
                entry: entry,
                personalization: result.personalization,
                threshold: threshold,
                viewTimeMs: viewTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs,
                enabled: viewsEnabled,
                client: client
            ))
            .modifier(TapTrackingModifier(
                entry: entry,
                personalization: result.personalization,
                enabled: tapsEnabled,
                onTap: onTap,
                client: client
            ))
            .accessibilityIdentifier(accessibilityIdentifier ?? "")
            .onReceive(client.$selectedPersonalizations) { newValue in
                guard isPersonalized, !shouldLiveUpdate, !isLocked, newValue != nil else { return }
                lockedPersonalizations = newValue
                isLocked = true
            }
    }
}
