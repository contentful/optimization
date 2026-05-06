import ContentfulOptimization
import UIKit

final class ContentEntryUIView: UIView {

    init(client: OptimizationClient, entry: [String: Any], scrollView: UIScrollView?) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let entryId = entryId(for: entry)
        let optimized = OptimizedEntryUIView(
            client: client,
            entry: entry,
            scrollView: scrollView,
            trackTaps: true,
            accessibilityIdentifier: "content-entry-\(entryId)"
        ) { resolved in
            EntryContentView(entry: resolved, entryId: entryId)
        }
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

private final class EntryContentView: UIView {

    init(entry: [String: Any], entryId: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let fields = entry["fields"] as? [String: Any]
        let text = (fields?["text"] as? String) ?? "No content"

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

private func entryId(for entry: [String: Any]) -> String {
    let sys = entry["sys"] as? [String: Any]
    return (sys?["id"] as? String) ?? ""
}
