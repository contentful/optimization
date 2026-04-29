import Combine
import UIKit

final class AnalyticsEventDisplayView: UIView {

    private let stack = UIStackView()
    private let titleLabel = UILabel()
    private let countLabel = UILabel()
    private var cancellables = Set<AnyCancellable>()

    init() {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        configure()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func configure() {
        accessibilityIdentifier = "analytics-events-container"
        isAccessibilityElement = false

        titleLabel.text = "Analytics Events"
        titleLabel.font = .preferredFont(forTextStyle: .headline)

        countLabel.accessibilityIdentifier = "events-count"
        countLabel.numberOfLines = 0

        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    func bind(to store: EventStore) {
        cancellables.removeAll()
        Publishers.CombineLatest(store.$events, store.$componentStats)
            .sink { [weak self] events, stats in
                self?.render(events: events, stats: stats)
            }
            .store(in: &cancellables)
    }

    private func render(events: [EventStore.AnalyticsEvent], stats: [String: EventStore.ComponentStats]) {
        for view in stack.arrangedSubviews {
            stack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        stack.addArrangedSubview(titleLabel)

        countLabel.text = "Events: \(events.count)"
        countLabel.accessibilityLabel = "Events: \(events.count)"
        stack.addArrangedSubview(countLabel)

        if events.isEmpty {
            let none = makeLabel(
                text: "No events tracked yet",
                identifier: "no-events-message"
            )
            stack.addArrangedSubview(none)
            return
        }

        let nonComponent = events.filter { $0.type != "component" }
        for (index, event) in nonComponent.enumerated() {
            let testId = event.componentId.map { "event-\(event.type)-\($0)" }
                ?? "event-\(event.type)-\(index)"
            let desc = describe(event)
            stack.addArrangedSubview(makeLabel(text: desc, identifier: testId))
        }

        for cid in stats.keys.sorted() {
            guard let s = stats[cid] else { continue }
            let container = UIView()
            container.translatesAutoresizingMaskIntoConstraints = false
            container.accessibilityIdentifier = "component-stats-\(cid)"

            let inner = UIStackView()
            inner.axis = .vertical
            inner.alignment = .leading
            inner.spacing = 2
            inner.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(inner)
            NSLayoutConstraint.activate([
                inner.topAnchor.constraint(equalTo: container.topAnchor),
                inner.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                inner.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                inner.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            ])

            inner.addArrangedSubview(makeLabel(text: "Count: \(s.count)", identifier: "event-count-\(cid)"))
            let durationText = s.latestViewDurationMs.map { "\($0)" } ?? "N/A"
            inner.addArrangedSubview(makeLabel(text: "Duration: \(durationText)", identifier: "event-duration-\(cid)"))
            let viewIdText = s.latestViewId ?? "N/A"
            inner.addArrangedSubview(makeLabel(text: "ViewId: \(viewIdText)", identifier: "event-view-id-\(cid)"))

            stack.addArrangedSubview(container)
        }
    }

    private func makeLabel(text: String, identifier: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.accessibilityLabel = text
        label.accessibilityIdentifier = identifier
        label.numberOfLines = 0
        return label
    }

    private func describe(_ event: EventStore.AnalyticsEvent) -> String {
        var desc = event.type
        if let cid = event.componentId { desc += " - Component: \(cid)" }
        if let ms = event.viewDurationMs { desc += " - \(ms)ms" }
        return desc
    }
}
