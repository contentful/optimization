import SwiftUI

// This package also targets macOS (see Package.swift), where UIKit doesn't
// exist — guard the UIKit-only tap observer below and fall back to SwiftUI's
// `.simultaneousGesture` there.
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

/// Attaches its recognizer to the *window*, then scopes each tap back to its own
/// frame.
///
/// A nearer ancestor is not usable. SwiftUI draws `Text` and friends into a
/// shared display list rather than one `UIView` per view, and `.background()`
/// puts this observer in a container of its own — so the container SwiftUI
/// happens to place it in is not reliably an ancestor of the region the user
/// taps, and a recognizer there never sees the touch. The window always is an
/// ancestor. `cancelsTouchesInView`/`delaysTouchesEnded` are both off, so
/// observing from up there still never competes for touches a nested
/// interactive child needs.
private final class TapObserverView: UIView, UIGestureRecognizerDelegate {
    var onTap: (() -> Void)?
    private weak var attachedView: UIView?
    private var recognizer: UITapGestureRecognizer?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    deinit {
        detach()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard let window else {
            detach()
            return
        }
        attach(to: window)
    }

    private func attach(to view: UIView) {
        guard attachedView !== view else { return }
        detach()

        let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        recognizer.cancelsTouchesInView = false
        recognizer.delaysTouchesBegan = false
        recognizer.delaysTouchesEnded = false
        recognizer.delegate = self
        view.addGestureRecognizer(recognizer)

        self.recognizer = recognizer
        attachedView = view
    }

    private func detach() {
        if let recognizer, let attachedView {
            attachedView.removeGestureRecognizer(recognizer)
        }
        recognizer = nil
        attachedView = nil
    }

    /// The window-level recognizer sees every tap in the app, so a tap counts for
    /// this entry only when it lands inside this observer's frame — which
    /// `.background()` sizes to the tracked content. Matches the UIKit path,
    /// where the entry's own recognizer also fires for taps on nested controls.
    @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
        guard window != nil, !bounds.isEmpty else { return }
        guard bounds.contains(recognizer.location(in: self)) else { return }
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
