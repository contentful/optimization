import ContentfulOptimization
import UIKit

/// Regression coverage for the UIKit tap-tracking path ([NT-3829]'s SwiftUI
/// fix does not cover `OptimizedEntryUIView`): a `UIButton` nested inside an
/// `OptimizedEntryUIView` with `trackTaps: true` is expected to still receive
/// its own tap.
final class NestedButtonTapTestViewController: UIViewController {

    private let client: OptimizationClient
    private var bookTapCount = 0

    private let bookTapCountLabel = UILabel()
    private let bookButton = UIButton(type: .system)

    init(client: OptimizationClient) {
        self.client = client
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close", for: .normal)
        closeButton.accessibilityIdentifier = "close-nested-button-test-button"
        closeButton.addAction(UIAction { [weak self] _ in self?.dismiss(animated: false) }, for: .touchUpInside)

        updateBookTapCountLabel()
        bookTapCountLabel.accessibilityIdentifier = "book-tap-count"

        bookButton.setTitle("Book", for: .normal)
        bookButton.accessibilityIdentifier = "book-button"
        bookButton.addAction(UIAction { [weak self] _ in self?.handleBookTap() }, for: .touchUpInside)

        let entry: [String: Any] = [
            "sys": ["id": "nested-button-test-entry"],
            "fields": ["text": "Nested button test entry"],
        ]

        let entryLabel = UILabel()
        entryLabel.text = "Nested button test entry"

        let entryContent = UIStackView(arrangedSubviews: [entryLabel, bookButton])
        entryContent.axis = .vertical
        entryContent.alignment = .leading
        entryContent.spacing = 8
        entryContent.translatesAutoresizingMaskIntoConstraints = false

        let optimized = OptimizedEntryUIView(
            client: client,
            entry: entry,
            scrollView: nil,
            trackTaps: true,
            accessibilityIdentifier: "nested-button-test-entry"
        ) { _ in entryContent }

        let root = UIStackView(arrangedSubviews: [closeButton, bookTapCountLabel, optimized])
        root.axis = .vertical
        root.alignment = .leading
        root.spacing = 16
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)

        NSLayoutConstraint.activate([
            root.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            root.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            root.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
        ])
    }

    private func handleBookTap() {
        bookTapCount += 1
        updateBookTapCountLabel()
    }

    private func updateBookTapCountLabel() {
        let text = "Book taps: \(bookTapCount)"
        bookTapCountLabel.text = text
        bookTapCountLabel.accessibilityLabel = text
    }
}
