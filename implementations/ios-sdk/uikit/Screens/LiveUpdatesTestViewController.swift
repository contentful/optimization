import Combine
import ContentfulOptimization
import UIKit

final class LiveUpdatesTestViewController: UIViewController {

    private let client: OptimizationClient
    private let personalizedEntryId = "2Z2WLOx07InSewC3LUB3eX"
    private var entry: [String: Any]?
    private var isIdentified = false
    private var globalLiveUpdates = false
    private var isPreviewPanelSimulated = false

    private let scrollView = UIScrollView()
    private let rootStack = UIStackView()
    private let loadingLabel = UILabel()

    private let identifiedStatus = UILabel()
    private let liveUpdatesStatus = UILabel()
    private let previewPanelStatus = UILabel()

    private let identifyButton = UIButton(type: .system)
    private let resetButton = UIButton(type: .system)
    private let toggleLiveUpdatesButton = UIButton(type: .system)
    private let simulatePreviewPanelButton = UIButton(type: .system)

    private let sectionsHost = UIStackView()
    private var defaultSection: OptimizedEntryUIView?
    private var liveSection: OptimizedEntryUIView?
    private var lockedSection: OptimizedEntryUIView?

    init(client: OptimizationClient) {
        self.client = client
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        layout()
        Task { @MainActor in
            let entries = await ContentfulFetcher.fetchEntries(ids: [personalizedEntryId])
            self.entry = entries.first
            self.refreshUI()
        }
    }

    // MARK: - Layout

    private func layout() {
        loadingLabel.text = "Loading..."
        loadingLabel.textAlignment = .center

        scrollView.accessibilityIdentifier = "live-updates-scroll-view"
        scrollView.alwaysBounceVertical = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        rootStack.axis = .vertical
        rootStack.alignment = .fill
        rootStack.spacing = 12
        rootStack.isLayoutMarginsRelativeArrangement = true
        rootStack.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(rootStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

            rootStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            rootStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            rootStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            rootStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            rootStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])

        rootStack.addArrangedSubview(makeControlsSection())
        rootStack.addArrangedSubview(makeStatusSection())
        rootStack.addArrangedSubview(makePreviewPanelSection())
        rootStack.addArrangedSubview(loadingLabel)

        sectionsHost.axis = .vertical
        sectionsHost.alignment = .fill
        sectionsHost.spacing = 20
        rootStack.addArrangedSubview(sectionsHost)
    }

    private func makeControlsSection() -> UIView {
        let title = UILabel()
        title.text = "Live Updates Test Controls"
        title.font = .preferredFont(forTextStyle: .headline)

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close", for: .normal)
        closeButton.accessibilityIdentifier = "close-live-updates-test-button"
        closeButton.addAction(UIAction { [weak self] _ in self?.dismiss(animated: false) }, for: .touchUpInside)

        identifyButton.setTitle("Identify", for: .normal)
        identifyButton.accessibilityIdentifier = "live-updates-identify-button"
        identifyButton.addAction(UIAction { [weak self] _ in self?.handleIdentify() }, for: .touchUpInside)

        resetButton.setTitle("Reset", for: .normal)
        resetButton.accessibilityIdentifier = "live-updates-reset-button"
        resetButton.addAction(UIAction { [weak self] _ in self?.handleReset() }, for: .touchUpInside)
        resetButton.isHidden = true

        toggleLiveUpdatesButton.accessibilityIdentifier = "toggle-global-live-updates-button"
        toggleLiveUpdatesButton.addAction(UIAction { [weak self] _ in self?.toggleGlobal() }, for: .touchUpInside)
        updateGlobalToggleTitle()

        let buttons = UIStackView(arrangedSubviews: [closeButton, identifyButton, resetButton, toggleLiveUpdatesButton])
        buttons.axis = .horizontal
        buttons.spacing = 8
        buttons.distribution = .fillProportionally

        let stack = UIStackView(arrangedSubviews: [title, buttons])
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        return stack
    }

    private func makeStatusSection() -> UIView {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.addArrangedSubview(makeRow(prefix: "Identified:", valueLabel: identifiedStatus, identifier: "identified-status"))
        stack.addArrangedSubview(makeRow(prefix: "Global Live Updates:", valueLabel: liveUpdatesStatus, identifier: "global-live-updates-status"))
        return stack
    }

    private func makePreviewPanelSection() -> UIView {
        simulatePreviewPanelButton.accessibilityIdentifier = "simulate-preview-panel-button"
        simulatePreviewPanelButton.addAction(UIAction { [weak self] _ in self?.togglePreviewPanel() }, for: .touchUpInside)
        updatePreviewPanelButtonTitle()

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.addArrangedSubview(simulatePreviewPanelButton)
        stack.addArrangedSubview(makeRow(prefix: "Preview Panel:", valueLabel: previewPanelStatus, identifier: "preview-panel-status"))
        return stack
    }

    private func makeRow(prefix: String, valueLabel: UILabel, identifier: String) -> UIView {
        let prefixLabel = UILabel()
        prefixLabel.text = prefix

        valueLabel.accessibilityIdentifier = identifier
        valueLabel.numberOfLines = 0

        let row = UIStackView(arrangedSubviews: [prefixLabel, valueLabel])
        row.axis = .horizontal
        row.alignment = .firstBaseline
        row.spacing = 8
        return row
    }

    // MARK: - Status text

    private func refreshUI() {
        loadingLabel.isHidden = entry != nil
        sectionsHost.isHidden = entry == nil

        identifiedStatus.text = isIdentified ? "Yes" : "No"
        identifiedStatus.accessibilityLabel = identifiedStatus.text
        liveUpdatesStatus.text = globalLiveUpdates ? "ON" : "OFF"
        liveUpdatesStatus.accessibilityLabel = liveUpdatesStatus.text
        previewPanelStatus.text = isPreviewPanelSimulated ? "Open" : "Closed"
        previewPanelStatus.accessibilityLabel = previewPanelStatus.text

        rebuildSections()
    }

    private func updateGlobalToggleTitle() {
        toggleLiveUpdatesButton.setTitle("Global: \(globalLiveUpdates ? "ON" : "OFF")", for: .normal)
    }

    private func updatePreviewPanelButtonTitle() {
        let title = isPreviewPanelSimulated ? "Close Preview Panel" : "Simulate Preview Panel"
        simulatePreviewPanelButton.setTitle(title, for: .normal)
    }

    // MARK: - Sections

    private func rebuildSections() {
        for view in sectionsHost.arrangedSubviews {
            sectionsHost.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        defaultSection = nil
        liveSection = nil
        lockedSection = nil

        guard let entry else { return }

        sectionsHost.addArrangedSubview(makeSection(
            entry: entry,
            title: "Default Behavior (inherits global setting)",
            subtitle: "No liveUpdates prop - inherits from OptimizationRoot (false)",
            liveUpdates: nil,
            prefix: "default",
            sectionIdentifier: "default-personalization",
            store: { [weak self] in self?.defaultSection = $0 }
        ))
        sectionsHost.addArrangedSubview(makeSection(
            entry: entry,
            title: "Live Updates Enabled (liveUpdates=true)",
            subtitle: "Always updates when personalization state changes",
            liveUpdates: true,
            prefix: "live",
            sectionIdentifier: "live-personalization",
            store: { [weak self] in self?.liveSection = $0 }
        ))
        sectionsHost.addArrangedSubview(makeSection(
            entry: entry,
            title: "Locked (liveUpdates=false)",
            subtitle: "Never updates - locks to first variant received",
            liveUpdates: false,
            prefix: "locked",
            sectionIdentifier: "locked-personalization",
            store: { [weak self] in self?.lockedSection = $0 }
        ))
    }

    private func makeSection(
        entry: [String: Any],
        title: String,
        subtitle: String,
        liveUpdates: Bool?,
        prefix: String,
        sectionIdentifier: String,
        store: (OptimizedEntryUIView) -> Void
    ) -> UIView {
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .preferredFont(forTextStyle: .body)

        let subtitleLabel = UILabel()
        subtitleLabel.text = subtitle
        subtitleLabel.font = .preferredFont(forTextStyle: .caption1)

        let optimized = OptimizedEntryUIView(
            client: client,
            entry: entry,
            scrollView: scrollView,
            liveUpdates: effectiveLiveUpdates(for: liveUpdates),
            globalLiveUpdates: globalLiveUpdates,
            trackTaps: false,
            trackViews: true,
            accessibilityIdentifier: sectionIdentifier
        ) { resolved in
            LiveUpdatesEntryDisplay(entry: resolved, prefix: prefix)
        }
        store(optimized)

        let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel, optimized])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 6
        return stack
    }

    private func effectiveLiveUpdates(for liveUpdates: Bool?) -> Bool? {
        liveUpdates
    }

    // MARK: - Actions

    private func handleIdentify() {
        Task { @MainActor in
            _ = try? await client.identify(userId: "charles", traits: ["identified": true])
            self.isIdentified = true
            self.identifyButton.isHidden = true
            self.resetButton.isHidden = false
            self.refreshStatusOnly()
        }
    }

    private func handleReset() {
        client.reset()
        Task { @MainActor in
            _ = try? await client.page(properties: ["url": "live-updates-test"])
        }
        isIdentified = false
        identifyButton.isHidden = false
        resetButton.isHidden = true
        refreshStatusOnly()
    }

    private func toggleGlobal() {
        globalLiveUpdates.toggle()
        updateGlobalToggleTitle()
        refreshUI()
    }

    private func togglePreviewPanel() {
        isPreviewPanelSimulated.toggle()
        updatePreviewPanelButtonTitle()
        refreshUI()
    }

    private func refreshStatusOnly() {
        identifiedStatus.text = isIdentified ? "Yes" : "No"
        identifiedStatus.accessibilityLabel = identifiedStatus.text
    }
}

// MARK: - LiveUpdatesEntryDisplay

private final class LiveUpdatesEntryDisplay: UIView {

    init(entry: [String: Any], prefix: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let entryId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""
        let fields = entry["fields"] as? [String: Any]
        let text = (fields?["text"] as? String) ?? "No content"

        let textLabel = UILabel()
        textLabel.text = text
        textLabel.accessibilityLabel = text
        textLabel.accessibilityIdentifier = "\(prefix)-text"
        textLabel.numberOfLines = 0

        let idLabel = UILabel()
        idLabel.text = "Entry: \(entryId)"
        idLabel.accessibilityLabel = "Entry: \(entryId)"
        idLabel.accessibilityIdentifier = "\(prefix)-entry-id"
        idLabel.font = .preferredFont(forTextStyle: .footnote)

        let stack = UIStackView(arrangedSubviews: [textLabel, idLabel])
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        accessibilityIdentifier = "\(prefix)-container"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}
