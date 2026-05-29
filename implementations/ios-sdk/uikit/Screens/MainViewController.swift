import Combine
import ContentfulOptimization
import UIKit

final class MainViewController: UIViewController {

    private let client: OptimizationClient
    private var entries: [[String: Any]] = []
    private var firstAppearHandled = false
    private var flagSubscribed = false
    private var cancellables = Set<AnyCancellable>()

    private let identifyButton = UIButton(type: .system)
    private let resetButton = UIButton(type: .system)
    private let navigationTestButton = UIButton(type: .system)
    private let liveUpdatesTestButton = UIButton(type: .system)
    private let simulateOfflineButton = UIButton(type: .system)
    private let simulateOnlineButton = UIButton(type: .system)
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let analyticsView = AnalyticsEventDisplayView()
    private let loadingLabel = UILabel()

    init(client: OptimizationClient) {
        self.client = client
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        configureControls()
        configureScrollView()
        layout()

        EventStore.shared.subscribe(to: client.eventPublisher)
        analyticsView.bind(to: EventStore.shared)

        client.$state
            .map { $0.profile }
            .removeDuplicates { lhs, rhs in
                let opts: JSONSerialization.WritingOptions = [.sortedKeys]
                let l = lhs.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: opts) }
                let r = rhs.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: opts) }
                return l == r
            }
            .sink { [weak self] profile in
                guard let self else { return }
                self.updateIdentifyControls(profile: profile)
                guard profile != nil else { return }
                // Subscribe to the `boolean` flag once a profile (and consent)
                // is available so a flag-view `component` event is emitted.
                if !self.flagSubscribed {
                    self.flagSubscribed = true
                    self.client.subscribeToFlag("boolean")
                }
                Task { @MainActor in
                    let fetched = await ContentfulFetcher.fetchEntries(
                        ids: AppConfig.entryIds,
                        locale: self.client.locale ?? AppConfig.defaultContentfulLocale
                    )
                    self.entries = fetched
                    self.reloadContent()
                }
            }
            .store(in: &cancellables)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !firstAppearHandled else { return }
        firstAppearHandled = true

        client.consent(true)
        Task { @MainActor in
            _ = try? await client.page(properties: ["url": "app"])
        }
    }

    private var networkControlsEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--enable-network-controls")
    }

    // MARK: - Layout

    private func configureControls() {
        identifyButton.setTitle("Identify", for: .normal)
        identifyButton.accessibilityIdentifier = "identify-button"
        identifyButton.addAction(UIAction { [weak self] _ in self?.handleIdentify() }, for: .touchUpInside)

        resetButton.setTitle("Reset", for: .normal)
        resetButton.accessibilityIdentifier = "reset-button"
        resetButton.addAction(UIAction { [weak self] _ in self?.handleReset() }, for: .touchUpInside)
        resetButton.isHidden = true

        navigationTestButton.setTitle("Navigation Test", for: .normal)
        navigationTestButton.accessibilityIdentifier = "navigation-test-button"
        navigationTestButton.addAction(UIAction { [weak self] _ in self?.openNavigationTest() }, for: .touchUpInside)

        liveUpdatesTestButton.setTitle("Live Updates Test", for: .normal)
        liveUpdatesTestButton.accessibilityIdentifier = "live-updates-test-button"
        liveUpdatesTestButton.addAction(UIAction { [weak self] _ in self?.openLiveUpdatesTest() }, for: .touchUpInside)

        simulateOfflineButton.setTitle("Go Offline", for: .normal)
        simulateOfflineButton.accessibilityIdentifier = "simulate-offline-button"
        simulateOfflineButton.addAction(UIAction { [weak self] _ in self?.client.setOnline(false) }, for: .touchUpInside)

        simulateOnlineButton.setTitle("Go Online", for: .normal)
        simulateOnlineButton.accessibilityIdentifier = "simulate-online-button"
        simulateOnlineButton.addAction(UIAction { [weak self] _ in self?.client.setOnline(true) }, for: .touchUpInside)

        loadingLabel.text = "Loading..."
        loadingLabel.textAlignment = .center
    }

    private func configureScrollView() {
        scrollView.accessibilityIdentifier = "main-scroll-view"
        scrollView.alwaysBounceVertical = true
        contentStack.axis = .vertical
        contentStack.alignment = .fill
        contentStack.spacing = 0
    }

    private func layout() {
        let buttonRow = UIStackView(arrangedSubviews: [identifyButton, resetButton, navigationTestButton, liveUpdatesTestButton])
        buttonRow.axis = .horizontal
        buttonRow.distribution = .fillEqually
        buttonRow.spacing = 8

        let root = UIStackView(arrangedSubviews: [buttonRow])
        root.axis = .vertical
        root.spacing = 8
        root.translatesAutoresizingMaskIntoConstraints = false

        // Test-only runtime network controls. XCUITest cannot toggle real
        // connectivity, so the offline-behavior suite drives the SDK online
        // state on the live process — keeping the in-memory Experience queue
        // intact across the offline/online transition.
        if networkControlsEnabled {
            let networkRow = UIStackView(arrangedSubviews: [simulateOfflineButton, simulateOnlineButton])
            networkRow.axis = .horizontal
            networkRow.distribution = .fillEqually
            networkRow.spacing = 8
            root.addArrangedSubview(networkRow)
        }

        root.addArrangedSubview(scrollView)
        view.addSubview(root)

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        contentStack.addArrangedSubview(loadingLabel)

        analyticsView.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            root.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            root.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            root.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            root.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])
    }

    private func reloadContent() {
        for view in contentStack.arrangedSubviews {
            contentStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        if entries.isEmpty {
            contentStack.addArrangedSubview(loadingLabel)
            return
        }

        for entry in entries {
            if isNestedContent(entry) {
                contentStack.addArrangedSubview(NestedContentEntryUIView(client: client, entry: entry, scrollView: scrollView))
            } else {
                contentStack.addArrangedSubview(ContentEntryUIView(client: client, entry: entry, scrollView: scrollView))
            }
        }
        contentStack.addArrangedSubview(analyticsView)
    }

    // MARK: - Actions

    private func handleIdentify() {
        Task { @MainActor in
            _ = try? await client.identify(userId: "charles", traits: ["identified": true])
        }
    }

    private func handleReset() {
        client.reset()
        Task { @MainActor in
            _ = try? await client.page(properties: ["url": "app"])
        }
    }

    /// Derive the identify/reset control from the SDK profile so a rehydrated
    /// identified profile shows the reset control after a cold start, and the
    /// control only flips once `identify` has resolved and been persisted.
    private func updateIdentifyControls(profile: [String: Any]?) {
        let traits = profile?["traits"] as? [String: Any]
        let identified = traits?["identified"] as? Bool == true
        identifyButton.isHidden = identified
        resetButton.isHidden = !identified
    }

    private func openNavigationTest() {
        let nav = NavigationTestViewController(client: client)
        nav.modalPresentationStyle = .fullScreen
        present(nav, animated: false)
    }

    private func openLiveUpdatesTest() {
        let live = LiveUpdatesTestViewController(client: client)
        live.modalPresentationStyle = .fullScreen
        present(live, animated: false)
    }

    // MARK: - Helpers

    private func isNestedContent(_ entry: [String: Any]) -> Bool {
        guard let sys = entry["sys"] as? [String: Any],
              let contentType = sys["contentType"] as? [String: Any],
              let innerSys = contentType["sys"] as? [String: Any],
              let id = innerSys["id"] as? String
        else { return false }
        return id == "nestedContent"
    }

}
