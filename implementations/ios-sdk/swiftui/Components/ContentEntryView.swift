import ContentfulOptimization
import SwiftUI

struct ContentEntryView: View {
    let entry: [String: Any]

    @EnvironmentObject private var client: OptimizationClient

    private var entryId: String {
        let sys = entry["sys"] as? [String: Any]
        return sys?["id"] as? String ?? ""
    }

    var body: some View {
        OptimizedEntry(
            entry: entry,
            accessibilityIdentifier: "content-entry-\(entryId)"
        ) { resolvedEntry in
            EntryContent(entry: resolvedEntry, entryId: entryId, client: client)
        }
    }
}

private struct EntryContent: View {
    let entry: [String: Any]
    let entryId: String
    let client: OptimizationClient

    private var text: String {
        let fields = entry["fields"] as? [String: Any]
        return RichText.resolveText(fields?["text"], client: client)
    }

    var body: some View {
        VStack(alignment: .leading) {
            Text(text)
            Text("[Entry: \(entryId)]")
        }
        .padding()
        // A card-sized minimum height keeps the home list taller than the
        // viewport so the lower entries genuinely start below the fold — the
        // layout the cross-platform view-tracking contract assumes.
        .frame(maxWidth: .infinity, minHeight: AppConfig.contentEntryMinHeight, alignment: .topLeading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(text) [Entry: \(entryId)]")
        .accessibilityIdentifier("entry-text-\(entryId)")
    }
}
