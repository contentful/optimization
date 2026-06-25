import SwiftUI

/// Configuration for automatic tracking behavior, provided via the SwiftUI environment.
///
/// Entry view and tap tracking both default to enabled. Pass `false` for either
/// value to opt out globally, or override individual `OptimizedEntry` views.
public struct TrackingConfig {
    public var trackViews: Bool
    public var trackTaps: Bool
    public var liveUpdates: Bool

    public init(trackViews: Bool = true, trackTaps: Bool = true, liveUpdates: Bool = false) {
        self.trackViews = trackViews
        self.trackTaps = trackTaps
        self.liveUpdates = liveUpdates
    }
}

struct TrackingConfigKey: EnvironmentKey {
    static let defaultValue = TrackingConfig()
}

extension EnvironmentValues {
    /// The tracking configuration for optimization components.
    public var trackingConfig: TrackingConfig {
        get { self[TrackingConfigKey.self] }
        set { self[TrackingConfigKey.self] = newValue }
    }
}
