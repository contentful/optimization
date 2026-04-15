import SwiftUI

/// Configuration for automatic tracking behavior, provided via the SwiftUI environment.
public struct TrackingConfig {
    public var trackViews: Bool
    public var trackTaps: Bool
    public var liveUpdates: Bool

    public init(trackViews: Bool = true, trackTaps: Bool = false, liveUpdates: Bool = false) {
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
