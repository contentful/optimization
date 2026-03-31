import SwiftUI

/// A view modifier that tracks tap gestures on a component and reports click events
/// to the optimization client.
struct TapTrackingModifier: ViewModifier {
    let entry: [String: Any]
    let personalization: [String: Any]?
    let enabled: Bool
    let onTap: (([String: Any]) -> Void)?
    let client: OptimizationClient

    func body(content: Content) -> some View {
        if enabled {
            content
                .simultaneousGesture(TapGesture().onEnded {
                    let metadata = TrackingMetadata(entry: entry, personalization: personalization)
                    let payload = TrackClickPayload(
                        componentId: metadata.componentId,
                        experienceId: metadata.experienceId,
                        variantIndex: metadata.variantIndex
                    )
                    Task { try? await client.trackClick(payload) }
                    onTap?(entry)
                })
        } else {
            content
        }
    }
}
