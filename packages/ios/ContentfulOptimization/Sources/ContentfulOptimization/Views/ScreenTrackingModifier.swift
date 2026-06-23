import SwiftUI

/// A `ViewModifier` that emits a screen event when the view appears.
public struct ScreenTrackingModifier: ViewModifier {
    let screenName: String

    @EnvironmentObject private var client: OptimizationClient

    public func body(content: Content) -> some View {
        content
            .onAppear {
                trackScreenIfAllowed()
            }
            .onChange(of: client.state.consent) { _ in
                trackScreenIfAllowed()
            }
            .onChange(of: screenName) { _ in
                trackScreenIfAllowed()
            }
    }

    private func trackScreenIfAllowed() {
        let requestedScreenName = screenName
        Task {
            _ = try? await client.trackCurrentScreen(name: requestedScreenName)
        }
    }
}

extension View {
    /// Track a screen view event when this view appears.
    public func trackScreen(name: String) -> some View {
        modifier(ScreenTrackingModifier(screenName: name))
    }
}
