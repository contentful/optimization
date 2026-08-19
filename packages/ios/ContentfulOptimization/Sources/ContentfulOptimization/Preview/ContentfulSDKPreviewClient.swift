import Contentful
import Foundation

/// A ``PreviewContentfulClient`` backed by an existing `contentful.swift` client.
///
/// The preview panel surfaces build this for an app that passes its own
/// `Contentful.Client`, so the panel shares that client's configuration,
/// credentials, and session rather than opening a second connection of its own.
/// Apps reach it through the `Contentful.Client` overloads on
/// ``PreviewPanelConfig``, ``PreviewPanelOverlay``, and
/// ``PreviewPanelViewController``; it is deliberately not public API, so an app
/// never names the adapter itself.
///
/// Entries are encoded to the dictionary shape ``ContentfulEntriesResult`` uses,
/// because the preview panel forwards them to the JS core, which runs the shared
/// entry mappers for every platform.
final class ContentfulSDKPreviewClient: PreviewContentfulClient {
    private let client: Contentful.Client

    init(client: Contentful.Client) {
        self.client = client
    }

    func getEntries(contentType: String, include: Int, skip: Int, limit: Int) async throws -> ContentfulEntriesResult {
        let query = Query.where(contentTypeId: contentType)
            .include(UInt(include))
            .skip(theFirst: UInt(skip))
            .limit(to: UInt(limit))

        let response = try await fetchArray(matching: query)

        // `contentful.swift` resolves links in place, so `items` carry expanded
        // linked entries where a raw CDA response carried link stubs. The entry
        // mappers read linked entries by `sys.id`, which both shapes provide,
        // and `includedEntries` still backs lookups.
        return ContentfulEntriesResult(
            items: response.items.map { CTEntry($0).toDictionary() },
            total: Int(response.total),
            skip: Int(response.skip),
            limit: Int(response.limit),
            includes: ContentfulIncludes(
                entries: (response.includedEntries ?? []).map { CTEntry($0).toDictionary() }
            )
        )
    }

    /// `contentful.swift` exposes only completion-handler fetches, so the
    /// `async` requirement bridges through a continuation.
    private func fetchArray(matching query: Query) async throws -> HomogeneousArrayResponse<Contentful.Entry> {
        try await withCheckedThrowingContinuation { continuation in
            client.fetchArray(of: Contentful.Entry.self, matching: query) { result in
                continuation.resume(with: result)
            }
        }
    }
}
