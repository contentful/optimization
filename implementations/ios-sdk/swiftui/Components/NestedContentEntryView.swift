import ContentfulOptimization
import SwiftUI

struct NestedContentEntryView: View {
    let entry: [String: Any]

    private var entryId: String {
        let sys = entry["sys"] as? [String: Any]
        return sys?["id"] as? String ?? ""
    }

    private var nestedEntries: [[String: Any]] {
        let fields = entry["fields"] as? [String: Any]
        guard let nestedArray = fields?["nested"] as? [Any] else { return [] }
        return nestedArray.compactMap { $0 as? [String: Any] }.filter { item in
            guard let sys = item["sys"] as? [String: Any] else { return false }
            return sys["id"] != nil
        }
    }

    var body: some View {
        VStack(alignment: .leading) {
            OptimizedEntry(
                entry: entry,
                accessibilityIdentifier: "content-entry-\(entryId)"
            ) { resolvedEntry in
                NestedEntryText(entry: resolvedEntry)
            }

            ForEach(0..<nestedEntries.count, id: \.self) { index in
                NestedContentEntryView(entry: nestedEntries[index])
            }
        }
    }
}

private struct NestedEntryText: View {
    let entry: [String: Any]

    private var entryId: String {
        let sys = entry["sys"] as? [String: Any]
        return sys?["id"] as? String ?? ""
    }

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
    }
}
