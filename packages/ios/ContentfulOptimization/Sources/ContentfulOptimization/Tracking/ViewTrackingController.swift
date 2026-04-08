#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif
import Foundation

/// Extracts tracking metadata from an entry and its resolved personalization.
public struct TrackingMetadata {
    public let componentId: String
    public let experienceId: String?
    public let variantIndex: Int
    public let sticky: Bool?

    public init(entry: [String: Any], personalization: [String: Any]?) {
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
public final class ViewTrackingController {
    public private(set) var isVisible: Bool = false

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

    // Last known visibility parameters for re-evaluation after resume
    private var lastElementY: CGFloat = 0
    private var lastElementHeight: CGFloat = 0
    private var lastScrollY: CGFloat = 0
    private var lastViewportHeight: CGFloat = 0

    #if canImport(UIKit)
    private var backgroundObserver: NSObjectProtocol?
    private var foregroundObserver: NSObjectProtocol?
    #endif

    /// The fallback viewport height when no scroll context is available.
    public static var fallbackViewportHeight: CGFloat {
        #if canImport(UIKit)
        UIScreen.main.bounds.height
        #elseif canImport(AppKit)
        NSScreen.main?.frame.height ?? 800
        #else
        800
        #endif
    }

    public init(
        client: OptimizationClient,
        entry: [String: Any],
        personalization: [String: Any]?,
        threshold: Double = 0.8,
        viewTimeMs: Int = 2000,
        viewDurationUpdateIntervalMs: Int = 5000
    ) {
        self.client = client
        self.metadata = TrackingMetadata(entry: entry, personalization: personalization)
        self.threshold = threshold
        self.viewTimeMs = viewTimeMs
        self.viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs

        #if canImport(UIKit)
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.pause() }
        }
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.resume() }
        }
        #endif
    }

    deinit {
        #if canImport(UIKit)
        if let obs = backgroundObserver { NotificationCenter.default.removeObserver(obs) }
        if let obs = foregroundObserver { NotificationCenter.default.removeObserver(obs) }
        #endif
    }

    /// Update the element's visibility based on its position relative to the viewport.
    public func updateVisibility(
        elementY: CGFloat,
        elementHeight: CGFloat,
        scrollY: CGFloat,
        viewportHeight: CGFloat
    ) {
        guard elementHeight > 0 else { return }

        // Store for re-evaluation after resume
        lastElementY = elementY
        lastElementHeight = elementHeight
        lastScrollY = scrollY
        lastViewportHeight = viewportHeight

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
    public func onDisappear() {
        if isVisible {
            onBecameInvisible()
        }
    }

    /// Pause tracking (e.g., when the app enters the background).
    public func pause() {
        pauseAccumulation()
        timer?.invalidate()
        timer = nil
        if attempts > 0 {
            emitEvent()
        }
        isVisible = false
        resetCycle()
    }

    /// Resume tracking after a pause. Resets visibility so it can be re-evaluated
    /// by the next geometry callback.
    public func resume() {
        isVisible = false
    }

    // MARK: - Private

    private func onBecameVisible() {
        isVisible = true
        viewId = UUID().uuidString
        visibleSince = Date()
        accumulatedMs = 0
        attempts = 0
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
