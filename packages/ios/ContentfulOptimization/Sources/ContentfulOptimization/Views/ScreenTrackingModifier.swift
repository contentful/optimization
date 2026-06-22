import SwiftUI

/// A `ViewModifier` that emits a screen event when the view appears.
public struct ScreenTrackingModifier: ViewModifier {
    let screenName: String

    @EnvironmentObject private var client: OptimizationClient
    @State private var trackingState = ScreenTrackingState()

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
        guard trackingState.shouldTrack(
            screenName,
            trackingAllowed: client.hasConsent(method: "screen")
        ) else { return }

        let requestedScreenName = screenName
        trackingState.markInFlight(requestedScreenName)
        Task {
            let result = try? await client.screenWithEmissionResult(name: requestedScreenName)
            if result?.accepted == true {
                trackingState.markAccepted(requestedScreenName)
            }
            trackingState.clearInFlight(requestedScreenName)
        }
    }
}

extension View {
    /// Track a screen view event when this view appears.
    public func trackScreen(name: String) -> some View {
        modifier(ScreenTrackingModifier(screenName: name))
    }
}
