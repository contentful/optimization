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
    @State private var controller: ViewTrackingController?

    func body(content: Content) -> some View {
        if enabled {
            if #available(iOS 18.0, macOS 15.0, *) {
                content
                    .onGeometryChange(for: CGRect.self) { proxy in
                        proxy.frame(in: .named(ScrollContext.coordinateSpaceName))
                    } action: { _, newFrame in
                        initControllerIfNeeded()
                        performVisibilityCheck(frame: newFrame)
                    }
                    .onAppear {
                        initControllerIfNeeded()
                    }
                    .onDisappear {
                        controller?.onDisappear()
                    }
            } else {
                content
                    .background(
                        GeometryReader { geo in
                            Color.clear
                                .onAppear {
                                    initControllerIfNeeded()
                                    performVisibilityCheck(frame: geo.frame(in: .named(ScrollContext.coordinateSpaceName)))
                                }
                                .onChange(of: scrollContext) { _ in
                                    performVisibilityCheck(frame: geo.frame(in: .named(ScrollContext.coordinateSpaceName)))
                                }
                        }
                    )
                    .onDisappear {
                        controller?.onDisappear()
                    }
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

    private func performVisibilityCheck(frame: CGRect) {
        guard let controller = controller else { return }
        let vpHeight = scrollContext?.viewportHeight ?? 0
        controller.updateVisibility(
            elementY: frame.origin.y,
            elementHeight: frame.size.height,
            scrollY: scrollContext?.scrollY ?? 0,
            viewportHeight: vpHeight > 0 ? vpHeight : ViewTrackingController.fallbackViewportHeight
        )
    }
}
