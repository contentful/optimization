import Combine
import ContentfulOptimization
import UIKit

@MainActor
final class ScreenLog: ObservableObject {
    @Published private(set) var names: [String] = []

    func append(_ name: String) {
        names.append(name)
    }
}

final class NavigationTestViewController: UINavigationController {

    private let client: OptimizationClient
    private let screenLog = ScreenLog()
    private var cancellables = Set<AnyCancellable>()

    init(client: OptimizationClient) {
        self.client = client
        let home = NavigationHomeViewController(client: client, log: screenLog)
        super.init(rootViewController: home)
        home.onClose = { [weak self] in self?.dismiss(animated: false) }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        client.eventPublisher
            .sink { [weak self] event in
                guard let type = event["type"] as? String,
                      type == "screen" || type == "screenViewEvent",
                      let name = event["name"] as? String
                else { return }
                Task { @MainActor in self?.screenLog.append(name) }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Home

private final class NavigationHomeViewController: UIViewController {

    var onClose: (() -> Void)?

    private let client: OptimizationClient
    private let log: ScreenLog
    private let logLabel = UILabel()
    private var cancellables = Set<AnyCancellable>()

    init(client: OptimizationClient, log: ScreenLog) {
        self.client = client
        self.log = log
        super.init(nibName: nil, bundle: nil)
        title = "Navigation Test"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close", for: .normal)
        closeButton.accessibilityIdentifier = "close-navigation-test-button"
        closeButton.addAction(UIAction { [weak self] _ in self?.onClose?() }, for: .touchUpInside)

        let goButton = UIButton(type: .system)
        goButton.setTitle("Go to View One", for: .normal)
        goButton.accessibilityIdentifier = "go-to-view-one-button"
        goButton.addAction(UIAction { [weak self] _ in self?.goToViewOne() }, for: .touchUpInside)

        logLabel.accessibilityIdentifier = "screen-event-log"
        logLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [closeButton, goButton, logLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
        ])

        log.$names
            .map { $0.joined(separator: ",") }
            .sink { [weak self] joined in
                self?.logLabel.text = joined
                self?.logLabel.accessibilityLabel = joined
            }
            .store(in: &cancellables)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { @MainActor in
            _ = try? await client.screen(name: "NavigationHome")
        }
    }

    private func goToViewOne() {
        let viewOne = NavigationViewContentVC(
            client: client,
            log: log,
            screenName: "NavigationViewOne",
            suffix: "one",
            nextTitle: "Go to View Two",
            nextIdentifier: "go-to-view-two-button",
            onNavigateNext: { [weak self] in self?.goToViewTwo() }
        )
        navigationController?.pushViewController(viewOne, animated: false)
    }

    private func goToViewTwo() {
        let viewTwo = NavigationViewContentVC(
            client: client,
            log: log,
            screenName: "NavigationViewTwo",
            suffix: "two",
            nextTitle: "Go to View Two",
            nextIdentifier: "go-to-view-two-button",
            onNavigateNext: nil
        )
        navigationController?.pushViewController(viewTwo, animated: false)
    }
}

// MARK: - Generic content VC for view one + view two

private final class NavigationViewContentVC: UIViewController {

    private let client: OptimizationClient
    private let log: ScreenLog
    private let screenName: String
    private let suffix: String
    private let nextTitle: String
    private let nextIdentifier: String
    private let onNavigateNext: (() -> Void)?

    private let lastLabel = UILabel()
    private let logLabel = UILabel()
    private var cancellables = Set<AnyCancellable>()

    init(
        client: OptimizationClient,
        log: ScreenLog,
        screenName: String,
        suffix: String,
        nextTitle: String,
        nextIdentifier: String,
        onNavigateNext: (() -> Void)?
    ) {
        self.client = client
        self.log = log
        self.screenName = screenName
        self.suffix = suffix
        self.nextTitle = nextTitle
        self.nextIdentifier = nextIdentifier
        self.onNavigateNext = onNavigateNext
        super.init(nibName: nil, bundle: nil)
        title = screenName
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.accessibilityIdentifier = "navigation-view-test-\(suffix)"
        view.addSubview(container)

        lastLabel.accessibilityIdentifier = "last-screen-event"
        lastLabel.numberOfLines = 0
        logLabel.accessibilityIdentifier = "screen-event-log"
        logLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [lastLabel, logLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        if let onNavigateNext {
            let nextButton = UIButton(type: .system)
            nextButton.setTitle(nextTitle, for: .normal)
            nextButton.accessibilityIdentifier = nextIdentifier
            nextButton.addAction(UIAction { _ in onNavigateNext() }, for: .touchUpInside)
            stack.addArrangedSubview(nextButton)
        }

        container.addSubview(stack)
        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            container.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            container.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),

            stack.topAnchor.constraint(equalTo: container.topAnchor),
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        log.$names
            .sink { [weak self] names in
                let last = names.last ?? ""
                self?.lastLabel.text = last
                self?.lastLabel.accessibilityLabel = last
                let joined = names.joined(separator: ",")
                self?.logLabel.text = joined
                self?.logLabel.accessibilityLabel = joined
            }
            .store(in: &cancellables)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { @MainActor in
            _ = try? await client.screen(name: screenName)
        }
    }
}

