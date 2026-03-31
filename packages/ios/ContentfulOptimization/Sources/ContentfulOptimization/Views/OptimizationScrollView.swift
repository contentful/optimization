import SwiftUI

/// Preference key for tracking scroll offset within ``OptimizationScrollView``.
struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

/// A scroll view that tracks scroll position and provides it to descendant views via the environment.
///
/// Descendant ``OptimizedEntry`` components automatically use the scroll
/// context for viewport-based view tracking.
///
/// ```swift
/// OptimizationScrollView {
///     VStack {
///         OptimizedEntry(entry: entry) { resolved in
///             Text(resolved["title"] as? String ?? "")
///         }
///     }
/// }
/// ```
public struct OptimizationScrollView<Content: View>: View {
    let accessibilityIdentifier: String?
    @ViewBuilder let content: () -> Content

    @State private var scrollY: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0

    public init(
        accessibilityIdentifier: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.accessibilityIdentifier = accessibilityIdentifier
        self.content = content
    }

    public var body: some View {
        ScrollView {
            content()
                .background(GeometryReader { geo in
                    Color.clear.preference(
                        key: ScrollOffsetPreferenceKey.self,
                        value: -geo.frame(in: .named(ScrollContext.coordinateSpaceName)).origin.y
                    )
                })
        }
        .coordinateSpace(name: ScrollContext.coordinateSpaceName)
        .onPreferenceChange(ScrollOffsetPreferenceKey.self) { scrollY = $0 }
        .background(GeometryReader { geo in
            Color.clear
                .onAppear { viewportHeight = geo.size.height }
                .onChange(of: geo.size.height) { newHeight in
                    viewportHeight = newHeight
                }
        })
        .environment(\.scrollContext, ScrollContext(scrollY: scrollY, viewportHeight: viewportHeight))
        .accessibilityIdentifier(accessibilityIdentifier ?? "")
    }
}
