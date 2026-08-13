import Contentful
import ContentfulOptimization
import Foundation

/// `PreviewContentfulClient` backed by `contentful.swift`, targeting the local
/// mock server rather than Contentful's production CDA.
///
/// Wrapping an existing Contentful SDK client is the integration the protocol
/// documents, as opposed to the built-in `ContentfulHTTPPreviewClient`. The
/// protocol is dictionary-shaped, so fetched entries are encoded back down with
/// `CTEntry.toDictionary()`.
final class MockPreviewContentfulClient: PreviewContentfulClient {

    func getEntries(contentType: String, include: Int, skip: Int, limit: Int) async throws -> ContentfulEntriesResult {
        let query = Query.where(contentTypeId: contentType)
            .include(UInt(include))
            .skip(theFirst: UInt(skip))
            .limit(to: UInt(limit))

        let response = try await MockContentfulClient.fetchEntries(matching: query)

        // `contentful.swift` resolves links in place, so `items` carry expanded
        // linked entries where the raw CDA response carried link stubs. The
        // preview mappers read linked entries by `sys.id`, which both shapes
        // provide, and `includes.Entry` is still populated for lookups.
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
}
