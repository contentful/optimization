import ContentfulOptimization
import SwiftUI

struct ContentEntryView: View {
    let entry: [String: Any]

    private var entryId: String {
        let sys = entry["sys"] as? [String: Any]
        return sys?["id"] as? String ?? ""
    }

    var body: some View {
        OptimizedEntry(
            entry: entry,
            trackTaps: true,
            accessibilityIdentifier: "content-entry-\(entryId)"
        ) { resolvedEntry in
            EntryContent(entry: resolvedEntry, entryId: entryId)
        }
    }
}

private struct EntryContent: View {
    let entry: [String: Any]
    let entryId: String

    private var text: String {
        let fields = entry["fields"] as? [String: Any]
        return fields?["text"] as? String ?? "No content"
    }

    var body: some View {
        VStack(alignment: .leading) {
            Text(text)
            Text("[Entry: \(entryId)]")
        }
        .padding()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(text) [Entry: \(entryId)]")
        .accessibilityIdentifier("entry-text-\(entryId)")
    }
}
