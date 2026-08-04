import SwiftUI

#if canImport(UIKit)
import UIKit

/// SwiftUI's `.simultaneousGesture` can still swallow a nested `Button`'s tap.
/// This observes taps via a plain `UITapGestureRecognizer` instead, which never
/// blocks a nested child's own touches.
private struct TapObserver: UIViewRepresentable {
    let onTap: () -> Void

    func makeUIView(context: Context) -> TapObserverView {
        TapObserverView()
    }

    func updateUIView(_ uiView: TapObserverView, context: Context) {
        uiView.onTap = onTap
    }
}

/// Attaches its recognizer to its *superview*, not itself: SwiftUI's
/// `.background()` makes this a sibling of `content`, and a sibling's
/// recognizer never sees touches that hit-test into `content`.
private final class TapObserverView: UIView, UIGestureRecognizerDelegate {
    var onTap: (() -> Void)?
    private weak var attachedView: UIView?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func didMoveToSuperview() {
        super.didMoveToSuperview()
        guard let superview, attachedView !== superview else { return }
        attachedView = superview
        let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        recognizer.cancelsTouchesInView = false
        recognizer.delegate = self
        superview.addGestureRecognizer(recognizer)
    }

    @objc private func handleTap() {
        onTap?()
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        true
    }
}
#endif

/// Reports taps on `content` without blocking a nested interactive child.
/// Falls back to `.simultaneousGesture` where UIKit isn't available.
private func observingTaps<Content: View>(_ content: Content, onTap: @escaping () -> Void) -> some View {
    #if canImport(UIKit)
    content.background(TapObserver(onTap: onTap))
    #else
    content.simultaneousGesture(TapGesture().onEnded(onTap))
    #endif
}

/// A view modifier that tracks tap gestures on a component and reports click events
/// to the optimization client.
struct TapTrackingModifier: ViewModifier {
    let entry: [String: Any]
    let optimizationContextId: String?
    let selectedOptimization: [String: Any]?
    let enabled: Bool
    let onTap: (([String: Any]) -> Void)?
    let client: OptimizationClient

    func body(content: Content) -> some View {
        if enabled {
            observingTaps(content) {
                if client.hasConsent(method: "trackClick") {
                    let metadata = TrackingMetadata(
                        entry: entry,
                        optimizationContextId: optimizationContextId,
                        selectedOptimization: selectedOptimization
                    )
                    let payload = TrackClickPayload(
                        componentId: metadata.componentId,
                        experienceId: metadata.experienceId,
                        optimizationContextId: metadata.optimizationContextId,
                        variantIndex: metadata.variantIndex
                    )
                    Task { try? await client.trackClick(payload) }
                }
                onTap?(entry)
            }
        } else {
            content
        }
    }
}
