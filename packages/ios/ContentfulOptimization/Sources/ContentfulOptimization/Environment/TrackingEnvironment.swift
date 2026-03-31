import SwiftUI

/// Scroll position context provided by ``OptimizationScrollView``.
public struct ScrollContext: Equatable {
    /// The coordinate space name used by ``OptimizationScrollView`` for scroll tracking.
    public static let coordinateSpaceName = "optimization-scroll"

    /// The current vertical scroll offset.
    public var scrollY: CGFloat

    /// The height of the visible viewport.
    public var viewportHeight: CGFloat

    public init(scrollY: CGFloat = 0, viewportHeight: CGFloat = 0) {
        self.scrollY = scrollY
        self.viewportHeight = viewportHeight
    }
}

struct ScrollContextKey: EnvironmentKey {
    static let defaultValue: ScrollContext? = nil
}

extension EnvironmentValues {
    /// The scroll context from the nearest ``OptimizationScrollView`` ancestor.
    public var scrollContext: ScrollContext? {
        get { self[ScrollContextKey.self] }
        set { self[ScrollContextKey.self] = newValue }
    }
}
