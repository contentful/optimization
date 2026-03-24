#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif
import Foundation

/// Extracts tracking metadata from an entry and its resolved personalization.
struct TrackingMetadata {
    let componentId: String
    let experienceId: String?
    let variantIndex: Int
    let sticky: Bool?

    init(entry: [String: Any], personalization: [String: Any]?) {
        let sys = entry["sys"] as? [String: Any]
        self.componentId = sys?["id"] as? String ?? ""
        self.experienceId = personalization?["experienceId"] as? String
        self.variantIndex = personalization?["variantIndex"] as? Int ?? 0
        self.sticky = personalization?["sticky"] as? Bool
    }
}

/// Manages viewport tracking for a single component, implementing the three-phase event lifecycle:
///
/// 1. **Initial event**: After accumulated visible time reaches `viewTimeMs` (default 2000ms)
/// 2. **Periodic updates**: Every `viewDurationUpdateIntervalMs` (default 5000ms) while visible
/// 3. **Final event**: When visibility ends (only if at least one event was already emitted)
///
/// State machine per visibility cycle:
/// ```
/// INVISIBLE → (ratio >= threshold) → VISIBLE → timer → EMIT → schedule next
///                                       ↓
///                            (ratio < threshold) → INVISIBLE (emit final if attempts > 0)
/// ```
@MainActor
final class ViewTrackingController {
    private(set) var isVisible: Bool = false

    private weak var client: OptimizationClient?
    private let metadata: TrackingMetadata
    private let threshold: Double
    private let viewTimeMs: Int
    private let viewDurationUpdateIntervalMs: Int

    // Cycle state
    private var viewId: String?
    private var visibleSince: Date?
    private var accumulatedMs: Double = 0
    private var attempts: Int = 0
    private var timer: Timer?

    /// The fallback viewport height when no scroll context is available.
    static var fallbackViewportHeight: CGFloat {
        #if canImport(UIKit)
        UIScreen.main.bounds.height
        #elseif canImport(AppKit)
        NSScreen.main?.frame.height ?? 800
        #else
        800
        #endif
    }

    init(
        client: OptimizationClient,
        entry: [String: Any],
        personalization: [String: Any]?,
        threshold: Double,
        viewTimeMs: Int,
        viewDurationUpdateIntervalMs: Int
    ) {
        self.client = client
        self.metadata = TrackingMetadata(entry: entry, personalization: personalization)
        self.threshold = threshold
        self.viewTimeMs = viewTimeMs
        self.viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs
    }

    /// Update the element's visibility based on its position relative to the viewport.
    func updateVisibility(
        elementY: CGFloat,
        elementHeight: CGFloat,
        scrollY: CGFloat,
        viewportHeight: CGFloat
    ) {
        guard elementHeight > 0 else { return }

        let visibleTop = max(elementY, scrollY)
        let visibleBottom = min(elementY + elementHeight, scrollY + viewportHeight)
        let visibleHeight = max(0, visibleBottom - visibleTop)
        let visibilityRatio = Double(visibleHeight / elementHeight)

        let nowVisible = visibilityRatio >= threshold

        if nowVisible && !isVisible {
            onBecameVisible()
        } else if !nowVisible && isVisible {
            onBecameInvisible()
        }
    }

    /// Called when the view disappears from the hierarchy. Emits a final event if active.
    func onDisappear() {
        if isVisible {
            onBecameInvisible()
        }
    }

    /// Pause tracking (e.g., when the app enters the background).
    func pause() {
        pauseAccumulation()
        timer?.invalidate()
        timer = nil
        if attempts > 0 {
            emitEvent()
        }
        isVisible = false
        resetCycle()
    }

    /// Resume tracking after a pause. Resets visibility so it will be re-evaluated.
    func resume() {
        isVisible = false
    }

    // MARK: - Private

    private func onBecameVisible() {
        isVisible = true
        viewId = UUID().uuidString
        visibleSince = Date()
        scheduleNextFire()
    }

    private func onBecameInvisible() {
        isVisible = false
        timer?.invalidate()
        timer = nil
        flushAccumulatedTime()
        if attempts > 0 {
            emitEvent()
        }
        resetCycle()
    }

    /// Adds elapsed time since `visibleSince` to `accumulatedMs` and resets `visibleSince` to now.
    private func flushAccumulatedTime() {
        guard let since = visibleSince else { return }
        accumulatedMs += Date().timeIntervalSince(since) * 1000
        visibleSince = Date()
    }

    /// Pauses time accumulation without resetting the cycle (used when app is backgrounded).
    private func pauseAccumulation() {
        guard let since = visibleSince else { return }
        accumulatedMs += Date().timeIntervalSince(since) * 1000
        visibleSince = nil
    }

    private func scheduleNextFire() {
        flushAccumulatedTime()
        let requiredMs = Double(viewTimeMs) + Double(attempts) * Double(viewDurationUpdateIntervalMs)
        let remainingMs = max(0, requiredMs - accumulatedMs)
        let interval = remainingMs / 1000.0

        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.timerFired()
            }
        }
    }

    private func timerFired() {
        flushAccumulatedTime()
        emitEvent()
        attempts += 1
        scheduleNextFire()
    }

    private func emitEvent() {
        guard let client = client, let viewId = viewId else { return }
        let payload = TrackViewPayload(
            componentId: metadata.componentId,
            viewId: viewId,
            experienceId: metadata.experienceId,
            variantIndex: metadata.variantIndex,
            viewDurationMs: Int(accumulatedMs),
            sticky: metadata.sticky
        )
        Task {
            try? await client.trackView(payload)
        }
    }

    private func resetCycle() {
        viewId = nil
        visibleSince = nil
        accumulatedMs = 0
        attempts = 0
    }
}
