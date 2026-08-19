import Contentful
import ContentfulOptimization
import SwiftUI

struct NestedContentEntryView: View {
    /// A nested tree's root comes from the CDA as a `Contentful.Entry`, while its
    /// children arrive already expanded inside the resolved parent, as
    /// dictionaries. Both go through `OptimizedEntry` — each through the
    /// initializer matching its shape.
    private enum Source {
        case fetched(Contentful.Entry)
        case expanded([String: Any])
    }

    private let source: Source

    @EnvironmentObject private var client: OptimizationClient

    init(entry: Contentful.Entry) {
        source = .fetched(entry)
    }

    init(expandedEntry: [String: Any]) {
        source = .expanded(expandedEntry)
    }

    var body: some View {
        switch source {
        case let .fetched(entry):
            OptimizedEntry(
                entry: entry,
                accessibilityIdentifier: "content-entry-\(entry.sys.id)"
            ) { resolvedEntry in
                NestedContentItemView(resolvedEntry: resolvedEntry.toDictionary(), client: client)
            }
        case let .expanded(entry):
            OptimizedEntry(
                entry: entry,
                accessibilityIdentifier: "content-entry-\(entryId(of: entry))"
            ) { resolvedEntry in
                NestedContentItemView(resolvedEntry: resolvedEntry, client: client)
            }
        }
    }
}

/// Renders a resolved nested entry's text plus its children. Children are read
/// from the *resolved* entry so an identified/variant entry recurses into the
/// variant's nested children rather than the baseline's.
private struct NestedContentItemView: View {
    let resolvedEntry: [String: Any]
    let client: OptimizationClient

    private var nestedEntries: [[String: Any]] {
        let fields = resolvedEntry["fields"] as? [String: Any]
        guard let nestedArray = fields?["nested"] as? [Any] else { return [] }
        return nestedArray.compactMap { $0 as? [String: Any] }.filter { item in
            guard let sys = item["sys"] as? [String: Any] else { return false }
            return sys["id"] != nil
        }
    }

    var body: some View {
        VStack(alignment: .leading) {
            NestedEntryText(entry: resolvedEntry, client: client)

            ForEach(0..<nestedEntries.count, id: \.self) { index in
                NestedContentEntryView(expandedEntry: nestedEntries[index])
            }
        }
    }
}

private struct NestedEntryText: View {
    let entry: [String: Any]
    let client: OptimizationClient

    private var entryId: String {
        let sys = entry["sys"] as? [String: Any]
        return sys?["id"] as? String ?? ""
    }

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
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(text) [Entry: \(entryId)]")
        .accessibilityIdentifier("entry-text-\(entryId)")
    }
}

private func entryId(of entry: [String: Any]) -> String {
    let sys = entry["sys"] as? [String: Any]
    return sys?["id"] as? String ?? ""
}
