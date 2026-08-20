#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif
import Foundation

enum ViewTrackingDefaults {
    static let minimumVisibleRatio = 0.1
    static let dwellTimeMs = 1000
}

/// Extracts tracking metadata from an entry and its selected optimization.
public struct TrackingMetadata {
    public let componentId: String
    public let experienceId: String?
    public let optimizationContextId: String?
    public let variantIndex: Int
    public let sticky: Bool?

    public init(
        entry: [String: Any],
        optimizationContextId: String? = nil,
        selectedOptimization: [String: Any]?
    ) {
        let sys = entry["sys"] as? [String: Any]
        self.componentId = sys?["id"] as? String ?? ""
        self.experienceId = selectedOptimization?["experienceId"] as? String
        self.optimizationContextId = optimizationContextId
        self.variantIndex = selectedOptimization?["variantIndex"] as? Int ?? 0
        self.sticky = selectedOptimization?["sticky"] as? Bool
    }
}

/// Manages viewport tracking for a single component, implementing the two-phase event lifecycle:
///
/// 1. **Start event**: After 1000ms of accumulated visible time
/// 2. **Final event**: When visibility ends (only if the start event was emitted)
///
/// State machine per visibility cycle:
/// ```
/// INVISIBLE → (ratio >= 0.1) → QUALIFYING → timer → TRACKING
///                                     ↓                    ↓
///                            (ratio < 0.1)             (ratio < 0.1)
///                                     ↓                    ↓
///                                 INVISIBLE        EMIT FINAL → INVISIBLE
/// ```
@MainActor
public final class ViewTrackingController {
    public private(set) var isVisible: Bool = false

    private weak var client: OptimizationClient?
    private let metadata: TrackingMetadata

    // Cycle state
    private var viewId: String?
    private var visibleSince: Date?
    private var accumulatedMs: Double = 0
    private var hasEmittedStart = false
    private var timer: Timer?
    private let stickyTrackingKey = UUID().uuidString
    private let now: () -> Date
    private let onEvent: ((TrackViewPayload) -> Void)?

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

    public convenience init(
        client: OptimizationClient,
        entry: [String: Any],
        optimizationContextId: String? = nil,
        selectedOptimization: [String: Any]?
    ) {
        self.init(
            client: client,
            entry: entry,
            optimizationContextId: optimizationContextId,
            selectedOptimization: selectedOptimization,
            now: Date.init,
            onEvent: nil
        )
    }

    // Package tests inject a clock and payload sink through this initializer so
    // qualification and lifecycle transitions stay deterministic without a scheduler abstraction.
    init(
        client: OptimizationClient,
        entry: [String: Any],
        optimizationContextId: String? = nil,
        selectedOptimization: [String: Any]?,
        now: @escaping () -> Date,
        onEvent: ((TrackViewPayload) -> Void)?
    ) {
        self.client = client
        self.metadata = TrackingMetadata(
            entry: entry,
            optimizationContextId: optimizationContextId,
            selectedOptimization: selectedOptimization
        )
        self.now = now
        self.onEvent = onEvent
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

        guard client?.hasConsent(method: "trackView") == true else {
            if isVisible {
                onBecameInvisible()
            }
            return
        }

        let visibleTop = max(elementY, scrollY)
        let visibleBottom = min(elementY + elementHeight, scrollY + viewportHeight)
        let visibleHeight = max(0, visibleBottom - visibleTop)
        let visibilityRatio = Double(visibleHeight / elementHeight)

        let nowVisible = visibilityRatio >= ViewTrackingDefaults.minimumVisibleRatio

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
        if hasEmittedStart {
            emitEvent()
        }
        isVisible = false
        resetCycle()
    }

    /// Resume tracking after a pause. Resets visibility and immediately
    /// re-evaluates it from the last known geometry so a still-visible element
    /// starts a fresh cycle without waiting for an external geometry callback
    /// (which may never fire if nothing scrolls after foregrounding).
    public func resume() {
        isVisible = false
        updateVisibility(
            elementY: lastElementY,
            elementHeight: lastElementHeight,
            scrollY: lastScrollY,
            viewportHeight: lastViewportHeight
        )
    }

    // MARK: - Private

    private func onBecameVisible() {
        isVisible = true
        viewId = UUID().uuidString
        visibleSince = now()
        accumulatedMs = 0
        hasEmittedStart = false
        scheduleQualification()
    }

    private func onBecameInvisible() {
        isVisible = false
        timer?.invalidate()
        timer = nil
        flushAccumulatedTime()
        if hasEmittedStart {
            emitEvent()
        }
        resetCycle()
    }

    /// Adds elapsed time since `visibleSince` to `accumulatedMs` and resets `visibleSince` to now.
    private func flushAccumulatedTime() {
        guard let since = visibleSince else { return }
        let currentDate = now()
        accumulatedMs += currentDate.timeIntervalSince(since) * 1000
        visibleSince = currentDate
    }

    /// Pauses time accumulation without resetting the cycle (used when app is backgrounded).
    private func pauseAccumulation() {
        guard let since = visibleSince else { return }
        accumulatedMs += now().timeIntervalSince(since) * 1000
        visibleSince = nil
    }

    private func scheduleQualification() {
        flushAccumulatedTime()
        let remainingMs = max(
            0,
            Double(ViewTrackingDefaults.dwellTimeMs) - accumulatedMs
        )
        let interval = remainingMs / 1000.0

        timer?.invalidate()
        let qualificationTimer = Timer(timeInterval: interval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.qualificationTimerFired()
            }
        }
        timer = qualificationTimer
        // UIScrollView switches the main run loop into tracking mode while scrolling.
        RunLoop.main.add(qualificationTimer, forMode: .common)
    }

    // Internal for the same deterministic package-test seam used by the initializer above.
    func qualificationTimerFired() {
        timer?.invalidate()
        timer = nil

        guard isVisible, !hasEmittedStart else { return }

        flushAccumulatedTime()
        guard accumulatedMs >= Double(ViewTrackingDefaults.dwellTimeMs) else {
            scheduleQualification()
            return
        }

        hasEmittedStart = emitEvent()
    }

    @discardableResult
    private func emitEvent() -> Bool {
        guard let client = client, let viewId = viewId else { return false }
        guard client.hasConsent(method: "trackView") else { return false }

        let payload = TrackViewPayload(
            componentId: metadata.componentId,
            viewId: viewId,
            experienceId: metadata.experienceId,
            optimizationContextId: metadata.optimizationContextId,
            variantIndex: metadata.variantIndex,
            viewDurationMs: Int(accumulatedMs),
            sticky: metadata.sticky,
            stickyTrackingKey: stickyTrackingKey
        )
        if let onEvent {
            onEvent(payload)
            return true
        }
        Task {
            try? await client.trackView(payload)
        }
        return true
    }

    private func resetCycle() {
        viewId = nil
        visibleSince = nil
        accumulatedMs = 0
        hasEmittedStart = false
    }
}
