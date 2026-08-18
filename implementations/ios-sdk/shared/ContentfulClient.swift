import Contentful
import ContentfulOptimization
import Foundation

/// The demo app's Contentful Delivery API client: one `contentful.swift` client
/// behind every CDA read, including the preview panel's.
///
/// A production app constructs the client the same way, minus `host` and
/// `clientConfiguration`: those two point it at the local mock server over plain
/// HTTP instead of `cdn.contentful.com`.
final class ContentfulClient {

    /// One client for the whole app: `contentful.swift` fetches `/locales` once
    /// per client and caches the localization context it decodes entries with,
    /// so sharing avoids repeating that bootstrap per CDA consumer.
    static let shared = ContentfulClient()

    /// The preview panel reads audiences and experiences through the same
    /// client. `ContentfulSDKPreviewClient` is the SDK's wrapper for an existing
    /// `contentful.swift` client, so the app implements no entry mapping.
    static let previewClient: PreviewContentfulClient =
        ContentfulSDKPreviewClient(client: shared.client)

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
