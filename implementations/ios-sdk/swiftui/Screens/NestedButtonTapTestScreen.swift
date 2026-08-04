import ContentfulOptimization
import SwiftUI

/// On-screen setup for the `[NT-3829]` regression test
/// (`TapTrackingTests.testTappingNestedButtonWithTrackTapsEnabled`): renders
/// a "Book" `Button` nested inside an `OptimizedEntry` with `trackTaps: true`
/// — the exact shape that made the button untappable before the fix.
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
                // This is the exact setting the bug report was about: with
                // trackTaps enabled, the SDK's own tap-tracking gesture used
                // to swallow the "Book" button's tap below before it fired.
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
