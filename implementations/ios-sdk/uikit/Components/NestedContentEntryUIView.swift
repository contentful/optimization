import Contentful
import ContentfulOptimization
import UIKit

final class NestedContentEntryUIView: UIView {

    /// A nested tree's root comes from the CDA as a `Contentful.Entry`, while its
    /// children arrive already expanded inside the resolved parent, as
    /// dictionaries.
    private enum Source {
        case fetched(Contentful.Entry)
        case expanded([String: Any])
    }

    convenience init(client: OptimizationClient, entry: Contentful.Entry, scrollView: UIScrollView?) {
        self.init(client: client, source: .fetched(entry), scrollView: scrollView)
    }

    convenience init(client: OptimizationClient, expandedEntry: [String: Any], scrollView: UIScrollView?) {
        self.init(client: client, source: .expanded(expandedEntry), scrollView: scrollView)
    }

    private init(client: OptimizationClient, source: Source, scrollView: UIScrollView?) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let contentBuilder: (_ resolved: [String: Any]) -> UIView = { resolved in
            NestedContentItemUIView(client: client, resolvedEntry: resolved, scrollView: scrollView)
        }

        let optimized: OptimizedEntryUIView
        switch source {
        case let .fetched(entry):
            optimized = OptimizedEntryUIView(
                client: client,
                entry: entry,
                scrollView: scrollView,
                accessibilityIdentifier: "content-entry-\(entry.sys.id)",
                contentBuilder: contentBuilder
            )
        case let .expanded(entry):
            let entryId = (entry["sys"] as? [String: Any])?["id"] as? String ?? ""
            optimized = OptimizedEntryUIView(
                client: client,
                entry: entry,
                scrollView: scrollView,
                accessibilityIdentifier: "content-entry-\(entryId)",
                contentBuilder: contentBuilder
            )
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
            stack.addArrangedSubview(
                NestedContentEntryUIView(client: client, expandedEntry: child, scrollView: scrollView)
            )
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
