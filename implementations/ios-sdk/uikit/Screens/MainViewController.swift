import Combine
import ContentfulOptimization
import UIKit

final class MainViewController: UIViewController {

    private let client: OptimizationClient
    private var entries: [[String: Any]] = []
    private var isIdentified = false
    private var firstAppearHandled = false
    private var cancellables = Set<AnyCancellable>()

    private let identifyButton = UIButton(type: .system)
    private let resetButton = UIButton(type: .system)
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
            .removeDuplicates(by: profilesEqual)
            .sink { [weak self] profile in
                guard let self, profile != nil else { return }
                Task { @MainActor in
                    let fetched = await ContentfulFetcher.fetchEntries(ids: AppConfig.entryIds)
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
            if ProcessInfo.processInfo.arguments.contains("--simulate-offline") {
                client.setOnline(false)
            }
        }
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
        let buttonRow = UIStackView(arrangedSubviews: [identifyButton, resetButton])
        buttonRow.axis = .horizontal
        buttonRow.distribution = .fillEqually
        buttonRow.spacing = 8

        let root = UIStackView(arrangedSubviews: [buttonRow, scrollView])
        root.axis = .vertical
        root.spacing = 8
        root.translatesAutoresizingMaskIntoConstraints = false
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
        isIdentified = true
        identifyButton.isHidden = true
        resetButton.isHidden = false
    }

    private func handleReset() {
        client.reset()
        Task { @MainActor in
            _ = try? await client.page(properties: ["url": "app"])
        }
        isIdentified = false
        identifyButton.isHidden = false
        resetButton.isHidden = true
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

    private func profilesEqual(_ lhs: [String: Any]?, _ rhs: [String: Any]?) -> Bool {
        let opts: JSONSerialization.WritingOptions = [.sortedKeys]
        let l = lhs.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: opts) }
        let r = rhs.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: opts) }
        return l == r
    }
}
