import Contentful
import Foundation

/// Fetches the home screen's content entries from the Contentful Delivery API.
///
/// Entry-ID lookup is app-owned: the Optimization SDK resolves personalization
/// against entries the app supplies, it does not fetch them. The returned
/// `Contentful.Entry` values go straight into the SDK's typed entry APIs
/// (`OptimizedEntry(entry:)`, `resolveOptimizedEntry(baseline:)`), which encode
/// them through `CTEntry`.
struct ContentfulFetcher {

    /// Matches the `include=10` CDA contract: linked entries are resolved by
    /// `contentful.swift` up to ten levels deep.
    private static let includeDepth: UInt = 10

    static func fetchEntries(ids: [String], locale: String) async -> [Contentful.Entry] {
        var entries: [Contentful.Entry] = []
        for id in ids {
            if let entry = await fetchEntry(id: id, locale: locale) {
                entries.append(entry)
            }
        }
        return entries
    }

    static func fetchEntry(id: String, locale: String) async -> Contentful.Entry? {
        // Single-locale request. Entry resolution expects direct fields such as
        // `fields.nt_experiences`, so all-locale responses must not be used.
        let query = Query.where(sys: .id, .equals(id))
            .include(includeDepth)
            .localizeResults(withLocaleCode: locale)

        // A failed fetch renders as the loading state, which is what the
        // offline-behavior suite drives.
        let response = try? await MockContentfulClient.fetchEntries(matching: query)
        return response?.items.first
    }
}
