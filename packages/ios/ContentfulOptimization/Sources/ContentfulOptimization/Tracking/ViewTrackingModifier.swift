import SwiftUI

/// A view modifier that tracks the visibility of a component within a scroll view
/// and reports view events to the optimization client.
struct ViewTrackingModifier: ViewModifier {
    let entry: [String: Any]
    let personalization: [String: Any]?
    let threshold: Double
    let viewTimeMs: Int
    let viewDurationUpdateIntervalMs: Int
    let enabled: Bool
    let client: OptimizationClient

    @Environment(\.scrollContext) private var scrollContext
    @Environment(\.scenePhase) private var scenePhase
    @State private var controller: ViewTrackingController?

    func body(content: Content) -> some View {
        if enabled {
            content
                .background(
                    GeometryReader { geo in
                        Color.clear
                            .onAppear {
                                initControllerIfNeeded()
                                performVisibilityCheck(geo: geo)
                            }
                            .onChange(of: scrollContext) { _ in
                                performVisibilityCheck(geo: geo)
                            }
                    }
                )
                .onChange(of: scenePhase) { newPhase in
                    switch newPhase {
                    case .background, .inactive:
                        controller?.pause()
                    case .active:
                        controller?.resume()
                    @unknown default:
                        break
                    }
                }
                .onDisappear {
                    controller?.onDisappear()
                }
        } else {
            content
        }
    }

    private func initControllerIfNeeded() {
        if controller == nil {
            controller = ViewTrackingController(
                client: client,
                entry: entry,
                personalization: personalization,
                threshold: threshold,
                viewTimeMs: viewTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs
            )
        }
    }

    private func performVisibilityCheck(geo: GeometryProxy) {
        guard let controller = controller else { return }
        let frame = geo.frame(in: .named(ScrollContext.coordinateSpaceName))
        controller.updateVisibility(
            elementY: frame.origin.y,
            elementHeight: frame.size.height,
            scrollY: scrollContext?.scrollY ?? 0,
            viewportHeight: scrollContext?.viewportHeight ?? ViewTrackingController.fallbackViewportHeight
        )
    }
}
