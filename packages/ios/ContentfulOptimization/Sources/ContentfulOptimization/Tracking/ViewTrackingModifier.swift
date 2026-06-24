import SwiftUI

/// A view modifier that tracks the visibility of a component within a scroll view
/// and reports view events to the optimization client.
struct ViewTrackingModifier: ViewModifier {
    let entry: [String: Any]
    let optimizationContextId: String?
    let selectedOptimization: [String: Any]?
    let minVisibleRatio: Double
    let dwellTimeMs: Int
    let viewDurationUpdateIntervalMs: Int
    let enabled: Bool
    let client: OptimizationClient

    @Environment(\.scrollContext) private var scrollContext
    @State private var controller: ViewTrackingController?
    @State private var controllerOptimizationContextId: String?
    @State private var lastFrame: CGRect?

    func body(content: Content) -> some View {
        if enabled {
            if #available(iOS 18.0, macOS 15.0, *) {
                content
                    .onGeometryChange(for: CGRect.self) { proxy in
                        proxy.frame(in: .named(ScrollContext.coordinateSpaceName))
                    } action: { _, newFrame in
                        performVisibilityCheck(frame: newFrame)
                    }
                    .onChange(of: client.state.consent) { _ in
                        performLastVisibilityCheck()
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
                                .onChange(of: client.state.consent) { _ in
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
        guard client.hasConsent(method: "trackView") else {
            controller?.onDisappear()
            controller = nil
            controllerOptimizationContextId = nil
            return
        }

        if controllerOptimizationContextId != optimizationContextId {
            controller?.onDisappear()
            controller = nil
            controllerOptimizationContextId = nil
        }

        if controller == nil {
            controller = ViewTrackingController(
                client: client,
                entry: entry,
                optimizationContextId: optimizationContextId,
                selectedOptimization: selectedOptimization,
                minVisibleRatio: minVisibleRatio,
                dwellTimeMs: dwellTimeMs,
                viewDurationUpdateIntervalMs: viewDurationUpdateIntervalMs
            )
            controllerOptimizationContextId = optimizationContextId
        }
    }

    private func performVisibilityCheck(frame: CGRect) {
        lastFrame = frame
        initControllerIfNeeded()
        guard let controller = controller else { return }
        let vpHeight = scrollContext?.viewportHeight ?? 0
        controller.updateVisibility(
            elementY: frame.origin.y,
            elementHeight: frame.size.height,
            scrollY: scrollContext?.scrollY ?? 0,
            viewportHeight: vpHeight > 0 ? vpHeight : ViewTrackingController.fallbackViewportHeight
        )
    }

    private func performLastVisibilityCheck() {
        guard let lastFrame else { return }

        performVisibilityCheck(frame: lastFrame)
    }
}
