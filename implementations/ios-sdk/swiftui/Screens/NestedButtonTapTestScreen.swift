import ContentfulOptimization
import SwiftUI

/// Regression coverage for the SwiftUI `OptimizedEntry` tap-tracking fix
/// ([NT-3829]): a `Button` nested inside an `OptimizedEntry` with
/// `trackTaps: true` must still receive its own tap, and the entry's tap
/// tracking must still fire alongside it.
struct NestedButtonTapTestScreen: View {
    let onClose: () -> Void
    @State private var bookTapCount = 0

    private var entry: [String: Any] {
        [
            "sys": ["id": "nested-button-test-entry"],
            "fields": ["text": "Nested button test entry"],
        ]
    }

    var body: some View {
        VStack(spacing: 16) {
            Button("Close") { onClose() }
                .accessibilityIdentifier("close-nested-button-test-button")

            Text("Book taps: \(bookTapCount)")
                .accessibilityLabel("Book taps: \(bookTapCount)")
                .accessibilityIdentifier("book-tap-count")

            OptimizedEntry(
                entry: entry,
                trackTaps: true,
                accessibilityIdentifier: "nested-button-test-entry"
            ) { resolvedEntry in
                let fields = resolvedEntry["fields"] as? [String: Any]
                let text = fields?["text"] as? String ?? ""
                VStack {
                    Text(text)
                    Button("Book") { bookTapCount += 1 }
                        .accessibilityIdentifier("book-button")
                }
                .padding()
            }
        }
        .padding()
    }
}
