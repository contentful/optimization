import Combine
import ContentfulOptimization
import UIKit

final class OptimizedEntryUIView: UIView {

    private let client: OptimizationClient
    private let entry: [String: Any]
    private let liveUpdates: Bool?
    private let globalLiveUpdates: Bool
    private let trackTaps: Bool
    private let trackViews: Bool
    private let contentBuilder: (_ resolved: [String: Any]) -> UIView

    private weak var scrollView: UIScrollView?
    private var trackingController: ViewTrackingController?
    private var lockedPersonalizations: [[String: Any]]?
    private var hasLocked = false
    private var resolvedEntry: [String: Any]
    private var resolvedPersonalization: [String: Any]?
    private var contentView: UIView?
    private var cancellables = Set<AnyCancellable>()
    private var contentOffsetObservation: NSKeyValueObservation?
    private var boundsObservation: NSKeyValueObservation?

    init(
        client: OptimizationClient,
        entry: [String: Any],
        scrollView: UIScrollView?,
        liveUpdates: Bool? = nil,
        globalLiveUpdates: Bool = false,
        trackTaps: Bool = false,
        trackViews: Bool = true,
        accessibilityIdentifier: String? = nil,
        contentBuilder: @escaping (_ resolved: [String: Any]) -> UIView
    ) {
        self.client = client
        self.entry = entry
        self.scrollView = scrollView
        self.liveUpdates = liveUpdates
        self.globalLiveUpdates = globalLiveUpdates
        self.trackTaps = trackTaps
        self.trackViews = trackViews
        self.contentBuilder = contentBuilder
        self.resolvedEntry = entry
        super.init(frame: .zero)
        self.accessibilityIdentifier = accessibilityIdentifier
        self.isAccessibilityElement = false
        self.translatesAutoresizingMaskIntoConstraints = false

        rebuildContent()

        if isPersonalized {
            subscribeToPersonalizations()
            subscribeToPreviewPanel()
        }

        if trackViews {
            installTracking()
        }
        if trackTaps {
            installTapGesture()
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    // Surface the inner content's accessibility label so XCUI tests querying
    // `otherElements[<our identifier>].label` see the resolved entry text.
    override var accessibilityLabel: String? {
        get { contentView?.accessibilityLabel ?? super.accessibilityLabel }
        set { super.accessibilityLabel = newValue }
    }

    deinit {
        contentOffsetObservation?.invalidate()
        boundsObservation?.invalidate()
        Task { @MainActor [trackingController] in
            trackingController?.onDisappear()
        }
    }

    // MARK: - Personalization

    private var isPersonalized: Bool {
        guard let fields = entry["fields"] as? [String: Any] else { return false }
        return fields["nt_experiences"] != nil
    }

    private var shouldLiveUpdate: Bool {
        if let explicit = liveUpdates { return explicit }
        return globalLiveUpdates || client.isPreviewPanelOpen
    }

    private var effectivePersonalizations: [[String: Any]]? {
        shouldLiveUpdate ? client.selectedPersonalizations : lockedPersonalizations
    }

    private func resolve() {
        if isPersonalized {
            let result = client.personalizeEntry(
                baseline: entry,
                personalizations: effectivePersonalizations
            )
            resolvedEntry = result.entry
            resolvedPersonalization = result.personalization
        } else {
            resolvedEntry = entry
            resolvedPersonalization = nil
        }
    }

    private func subscribeToPersonalizations() {
        client.$selectedPersonalizations
            .sink { [weak self] _ in
                guard let self else { return }
                if self.shouldLiveUpdate {
                    self.rebuildContent()
                } else if !self.hasLocked, let snapshot = self.client.selectedPersonalizations {
                    self.lockedPersonalizations = snapshot
                    self.hasLocked = true
                    self.rebuildContent()
                }
            }
            .store(in: &cancellables)
    }

    private func subscribeToPreviewPanel() {
        client.$isPreviewPanelOpen
            .dropFirst()
            .sink { [weak self] open in
                guard let self else { return }
                if !open, self.hasLocked {
                    self.lockedPersonalizations = self.client.selectedPersonalizations
                }
                self.rebuildContent()
            }
            .store(in: &cancellables)
    }

    private func rebuildContent() {
        resolve()
        let new = contentBuilder(resolvedEntry)
        new.translatesAutoresizingMaskIntoConstraints = false
        if let old = contentView {
            old.removeFromSuperview()
        }
        addSubview(new)
        NSLayoutConstraint.activate([
            new.topAnchor.constraint(equalTo: topAnchor),
            new.leadingAnchor.constraint(equalTo: leadingAnchor),
            new.trailingAnchor.constraint(equalTo: trailingAnchor),
            new.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        contentView = new

        rebuildTrackingMetadata()
    }

    // MARK: - View tracking

    private func rebuildTrackingMetadata() {
        guard trackViews else { return }
        trackingController?.onDisappear()
        trackingController = ViewTrackingController(
            client: client,
            entry: entry,
            personalization: resolvedPersonalization
        )
        emitVisibility()
    }

    private func installTracking() {
        rebuildTrackingMetadata()

        contentOffsetObservation = scrollView?.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.emitVisibility() }
        }
        boundsObservation = scrollView?.observe(\.bounds, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in self?.emitVisibility() }
        }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            emitVisibility()
        }
    }

    override func willMove(toWindow newWindow: UIWindow?) {
        super.willMove(toWindow: newWindow)
        if newWindow == nil {
            trackingController?.onDisappear()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        emitVisibility()
    }

    private func emitVisibility() {
        guard trackViews, let controller = trackingController else { return }
        guard window != nil, bounds.height > 0 else { return }

        if let scrollView {
            let frameInScroll = convert(bounds, to: scrollView)
            controller.updateVisibility(
                elementY: frameInScroll.minY,
                elementHeight: bounds.height,
                scrollY: scrollView.contentOffset.y,
                viewportHeight: scrollView.bounds.height
            )
        } else {
            // Fallback when there is no enclosing scroll view: treat as fully visible
            // when in window with the screen as the viewport.
            controller.updateVisibility(
                elementY: 0,
                elementHeight: bounds.height,
                scrollY: 0,
                viewportHeight: ViewTrackingController.fallbackViewportHeight
            )
        }
    }

    // MARK: - Tap tracking

    private func installTapGesture() {
        let recognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        addGestureRecognizer(recognizer)
        isUserInteractionEnabled = true
    }

    @objc private func handleTap() {
        let metadata = TrackingMetadata(entry: entry, personalization: resolvedPersonalization)
        let payload = TrackClickPayload(
            componentId: metadata.componentId,
            experienceId: metadata.experienceId,
            variantIndex: metadata.variantIndex
        )
        Task { @MainActor in
            _ = try? await client.trackClick(payload)
        }
    }
}
