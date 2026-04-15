import SwiftUI

/// A `ViewModifier` that calls `client.screen(name:)` when the view appears.
public struct ScreenTrackingModifier: ViewModifier {
    let screenName: String

    @EnvironmentObject private var client: OptimizationClient

    public func body(content: Content) -> some View {
        content
            .onAppear {
                Task {
                    try? await client.screen(name: screenName)
                }
            }
    }
}

extension View {
    /// Track a screen view event when this view appears.
    public func trackScreen(name: String) -> some View {
        modifier(ScreenTrackingModifier(screenName: name))
    }
}
