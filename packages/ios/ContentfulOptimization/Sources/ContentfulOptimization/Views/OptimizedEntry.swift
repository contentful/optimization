import Combine
import Contentful
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
    let entry: CTEntry
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
        self.entry = .parseWithFallback(entry)
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

    /// Accepts a `contentful.swift` `Entry` directly, encoding it to the `{sys, fields, metadata}`
    /// shape the resolver expects (see `CTEntry(_: Contentful.Entry)`) and handing the resolved
    /// variant back through `CTEntry` — `getField`, not `as?` casts on a raw map.
    /// The encoding happens once, here, at construction.
    public init(
        entry: Contentful.Entry,
        dwellTimeMs: Int = 2000,
        minVisibleRatio: Double = 0.8,
        viewDurationUpdateIntervalMs: Int = 5000,
        liveUpdates: Bool? = nil,
        trackViews: Bool? = nil,
        trackTaps: Bool? = nil,
        accessibilityIdentifier: String? = nil,
        onTap: (([String: Any]) -> Void)? = nil,
        @ViewBuilder content: @escaping (CTEntry) -> Content
    ) {
        self.entry = CTEntry(entry)
        self.dwellTimeMs = dwellTimeMs
        self.minVisibleRatio = minVisibleRatio
        self.viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs
        self.liveUpdates = liveUpdates
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.accessibilityIdentifier = accessibilityIdentifier
        self.onTap = onTap
        self.content = { raw in content(.parseWithFallback(raw, fallback: CTEntry(entry))) }
    }

    private var isOptimized: Bool {
        entry.hasField("nt_experiences")
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
        let entryDict = entry.toFoundation() as? [String: Any] ?? [:]
        let result: ResolvedOptimizedEntry = {
            if isOptimized {
                return client.resolveOptimizedEntry(
                    baseline: entryDict,
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

        content(result.entry.toFoundation() as? [String: Any] ?? [:])
            .modifier(ViewTrackingModifier(
                entry: entryDict,
                optimizationContextId: result.optimizationContextId,
                selectedOptimization: result.selectedOptimization,
                minVisibleRatio: minVisibleRatio,
                dwellTimeMs: dwellTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs,
                enabled: viewsEnabled,
                client: client
            ))
            .modifier(TapTrackingModifier(
                entry: entryDict,
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
