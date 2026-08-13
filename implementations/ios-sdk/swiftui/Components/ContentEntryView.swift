import Contentful
import ContentfulOptimization
import SwiftUI

struct ContentEntryView: View {
    let entry: Contentful.Entry

    @EnvironmentObject private var client: OptimizationClient

    var body: some View {
        // The `Contentful.Entry` initializer encodes the entry into the shape
        // the resolver expects once, at construction, and hands the resolved
        // variant back as a `CTEntry`.
        OptimizedEntry(
            entry: entry,
            accessibilityIdentifier: "content-entry-\(entry.sys.id)"
        ) { resolvedEntry in
            EntryContent(entry: resolvedEntry, entryId: entry.sys.id, client: client)
        }
    }
}

private struct EntryContent: View {
    let entry: CTEntry
    let entryId: String
    let client: OptimizationClient

    private var text: String {
        RichText.resolveText(entry, field: "text", client: client)
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
