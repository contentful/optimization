import ContentfulOptimization
import UIKit

final class NestedContentEntryUIView: UIView {

    init(client: OptimizationClient, entry: [String: Any], scrollView: UIScrollView?) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let entryId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""

        let optimized = OptimizedEntryUIView(
            client: client,
            entry: entry,
            scrollView: scrollView,
            accessibilityIdentifier: "content-entry-\(entryId)"
        ) { resolved in
            NestedContentItemUIView(client: client, resolvedEntry: resolved, scrollView: scrollView)
        }
        optimized.translatesAutoresizingMaskIntoConstraints = false
        addSubview(optimized)
        NSLayoutConstraint.activate([
            optimized.topAnchor.constraint(equalTo: topAnchor),
            optimized.leadingAnchor.constraint(equalTo: leadingAnchor),
            optimized.trailingAnchor.constraint(equalTo: trailingAnchor),
            optimized.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}

/// Renders a resolved nested entry's text plus its children. Children are read
/// from the *resolved* entry so an identified/variant entry recurses into the
/// variant's nested children rather than the baseline's.
private final class NestedContentItemUIView: UIView {

    init(client: OptimizationClient, resolvedEntry: [String: Any], scrollView: UIScrollView?) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 0
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        stack.addArrangedSubview(NestedEntryText(entry: resolvedEntry, client: client))

        for child in nestedEntries(in: resolvedEntry) {
            stack.addArrangedSubview(NestedContentEntryUIView(client: client, entry: child, scrollView: scrollView))
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func nestedEntries(in entry: [String: Any]) -> [[String: Any]] {
        let fields = entry["fields"] as? [String: Any]
        guard let nested = fields?["nested"] as? [Any] else { return [] }
        return nested.compactMap { $0 as? [String: Any] }.filter { item in
            (item["sys"] as? [String: Any])?["id"] != nil
        }
    }
}

private final class NestedEntryText: UIView {

    init(entry: [String: Any], client: OptimizationClient) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let entryId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""
        let fields = entry["fields"] as? [String: Any]
        let text = RichText.resolveText(fields?["text"], client: client)

        let textLabel = UILabel()
        textLabel.text = text
        textLabel.numberOfLines = 0

        let idLabel = UILabel()
        idLabel.text = "[Entry: \(entryId)]"
        idLabel.font = .preferredFont(forTextStyle: .footnote)

        let stack = UIStackView(arrangedSubviews: [textLabel, idLabel])
        stack.axis = .vertical
        stack.alignment = .leading
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        isAccessibilityElement = true
        accessibilityLabel = "\(text) [Entry: \(entryId)]"
        accessibilityIdentifier = "entry-text-\(entryId)"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}
