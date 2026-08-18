import Contentful
import ContentfulOptimization
import Foundation

/// The demo app's Contentful Delivery API client: one `contentful.swift` client
/// behind every CDA read, and the preview panel's `PreviewContentfulClient`.
///
/// Wrapping an existing Contentful SDK client is the preview-panel integration
/// the protocol documents, as opposed to the built-in
/// `ContentfulHTTPPreviewClient`.
///
/// A production app constructs the client the same way, minus `host` and
/// `clientConfiguration`: those two point it at the local mock server over plain
/// HTTP instead of `cdn.contentful.com`.
final class ContentfulClient: PreviewContentfulClient {

    /// One client for the whole app: `contentful.swift` fetches `/locales` once
    /// per client and caches the localization context it decodes entries with,
    /// so sharing avoids repeating that bootstrap per CDA consumer.
    static let shared = ContentfulClient()

    /// Matches the `include=10` CDA contract: linked entries are resolved by
    /// `contentful.swift` up to ten levels deep.
    private static let includeDepth: UInt = 10

    private let client: Contentful.Client

    private init() {
        var clientConfiguration = ClientConfiguration.default
        // The mock server is plain HTTP; both Info.plists allow arbitrary loads.
        clientConfiguration.secure = false

        client = Contentful.Client(
            spaceId: AppConfig.contentfulSpaceId,
            environmentId: AppConfig.environment,
            accessToken: AppConfig.contentfulAccessToken,
            host: AppConfig.contentfulHost,
            clientConfiguration: clientConfiguration
        )
    }

    // MARK: - Content entries

    /// Fetches the home screen's content entries by ID.
    ///
    /// Entry-ID lookup is app-owned: the Optimization SDK resolves
    /// personalization against entries the app supplies, it does not fetch them.
    /// The returned `Contentful.Entry` values go straight into the SDK's typed
    /// entry APIs (`OptimizedEntry(entry:)`, `resolveOptimizedEntry(baseline:)`),
    /// which encode them through `CTEntry`.
    static func fetchEntries(ids: [String], locale: String) async -> [Contentful.Entry] {
        var entries: [Contentful.Entry] = []
        for id in ids {
            if let entry = await shared.fetchEntry(id: id, locale: locale) {
                entries.append(entry)
            }
        }
        return entries
    }

    private func fetchEntry(id: String, locale: String) async -> Contentful.Entry? {
        // Single-locale request. Entry resolution expects direct fields such as
        // `fields.nt_experiences`, so all-locale responses must not be used.
        let query = Query.where(sys: .id, .equals(id))
            .include(Self.includeDepth)
            .localizeResults(withLocaleCode: locale)

        // A failed fetch renders as the loading state, which is what the
        // offline-behavior suite drives.
        let response = try? await fetchEntries(matching: query)
        return response?.items.first
    }

    // MARK: - PreviewContentfulClient

    func getEntries(contentType: String, include: Int, skip: Int, limit: Int) async throws -> ContentfulEntriesResult {
        let query = Query.where(contentTypeId: contentType)
            .include(UInt(include))
            .skip(theFirst: UInt(skip))
            .limit(to: UInt(limit))

        let response = try await fetchEntries(matching: query)

        // `contentful.swift` resolves links in place, so `items` carry expanded
        // linked entries where the raw CDA response carried link stubs. The
        // preview mappers read linked entries by `sys.id`, which both shapes
        // provide, and `includes.Entry` is still populated for lookups. The
        // protocol is dictionary-shaped, so entries are encoded back down with
        // `CTEntry.toDictionary()`.
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

    // MARK: - Fetch bridge

    /// `contentful.swift` 5.5.15 exposes only completion-handler fetches, so the
    /// app's `async` call sites bridge through a continuation.
    private func fetchEntries(matching query: Query) async throws -> HomogeneousArrayResponse<Contentful.Entry> {
        try await withCheckedThrowingContinuation { continuation in
            client.fetchArray(of: Contentful.Entry.self, matching: query) { result in
                continuation.resume(with: result)
            }
        }
    }
}
