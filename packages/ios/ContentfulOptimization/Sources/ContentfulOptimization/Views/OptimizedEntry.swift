import Combine
import SwiftUI

/// Unified component for tracking and optimizing Contentful entries.
///
/// Handles both optimized entries (with `nt_experiences`) and non-optimized
/// entries. For optimized entries, it resolves the correct variant based on the
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
    let dwellTimeMs: Int
    let minVisibleRatio: Double
    let viewDurationUpdateIntervalMs: Int
    let liveUpdates: Bool?
    let trackViews: Bool?
    let trackTaps: Bool?
    let accessibilityIdentifier: String?
    let onTap: (([String: Any]) -> Void)?
    @ViewBuilder let content: ([String: Any]) -> Content

    @EnvironmentObject private var client: OptimizationClient
    @Environment(\.trackingConfig) private var trackingConfig

    // Variant locking state (only used for optimized entries)
    @State private var lockedOptimizations: [[String: Any]]?
    @State private var isLocked: Bool = false

    public init(
        entry: [String: Any],
        dwellTimeMs: Int = 2000,
        minVisibleRatio: Double = 0.8,
        viewDurationUpdateIntervalMs: Int = 5000,
        liveUpdates: Bool? = nil,
        trackViews: Bool? = nil,
        trackTaps: Bool? = nil,
        accessibilityIdentifier: String? = nil,
        onTap: (([String: Any]) -> Void)? = nil,
        @ViewBuilder content: @escaping ([String: Any]) -> Content
    ) {
        self.entry = entry
        self.dwellTimeMs = dwellTimeMs
        self.minVisibleRatio = minVisibleRatio
        self.viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs
        self.liveUpdates = liveUpdates
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.accessibilityIdentifier = accessibilityIdentifier
        self.onTap = onTap
        self.content = content
    }

    private var isOptimized: Bool {
        guard let fields = entry["fields"] as? [String: Any] else { return false }
        return fields["nt_experiences"] != nil
    }

    // An open preview panel always forces live updates, overriding an explicit
    // `liveUpdates: false`. The global toggle only acts as the default when no
    // explicit per-component value is set.
    private var shouldLiveUpdate: Bool {
        if client.isPreviewPanelOpen { return true }
        if let explicit = liveUpdates { return explicit }
        return trackingConfig.liveUpdates
    }

    private var effectiveOptimizations: [[String: Any]]? {
        shouldLiveUpdate ? client.selectedOptimizations : lockedOptimizations
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
        let result: ResolvedOptimizedEntry = {
            if isOptimized {
                return client.resolveOptimizedEntry(
                    baseline: entry,
                    selectedOptimizations: effectiveOptimizations
                )
            } else {
                return ResolvedOptimizedEntry(
                    entry: entry,
                    selectedOptimization: nil,
                    optimizationContextId: nil
                )
            }
        }()

        content(result.entry)
            .modifier(ViewTrackingModifier(
                entry: entry,
                optimizationContextId: result.optimizationContextId,
                selectedOptimization: result.selectedOptimization,
                minVisibleRatio: minVisibleRatio,
                dwellTimeMs: dwellTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs,
                enabled: viewsEnabled,
                client: client
            ))
            .modifier(TapTrackingModifier(
                entry: entry,
                optimizationContextId: result.optimizationContextId,
                selectedOptimization: result.selectedOptimization,
                enabled: tapsEnabled,
                onTap: onTap,
                client: client
            ))
            // Expose the wrapper as an accessibility container rather than
            // letting `accessibilityIdentifier` collapse onto — and override the
            // identifier of — the single child element. This keeps the consumer's
            // own nested identifiers (e.g. `entry-text-<id>`) individually
            // queryable alongside this wrapper identifier.
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier(accessibilityIdentifier ?? "")
            .onReceive(client.$selectedOptimizations) { newValue in
                guard isOptimized, !shouldLiveUpdate, !isLocked, newValue != nil else { return }
                lockedOptimizations = newValue
                isLocked = true
            }
            // When preview panel closes, snapshot the current selectedOptimizations
            // so the locked state reflects any overrides applied during the session.
            .onReceive(client.$isPreviewPanelOpen) { panelOpen in
                guard isOptimized, !panelOpen, isLocked else { return }
                lockedOptimizations = client.selectedOptimizations
            }
    }
}
