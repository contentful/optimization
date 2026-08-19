import Contentful
import Foundation

/// The demo app's Contentful Delivery API client: one `contentful.swift` client
/// behind every CDA read, including the preview panel's.
///
/// A production app constructs the client the same way, minus `host` and
/// `clientConfiguration`: those two point it at the local mock server over plain
/// HTTP instead of `cdn.contentful.com`.
enum ContentfulClient {

    /// One client for the whole app: `contentful.swift` fetches `/locales` once
    /// per client and caches the localization context it decodes entries with,
    /// so sharing avoids repeating that bootstrap per CDA consumer.
    ///
    /// Handed to `PreviewPanelConfig` and `PreviewPanelViewController` so the
    /// preview panel reads audiences and experiences through this client too. The
    /// SDK wraps it internally, so the app implements no entry mapping.
    static let client: Contentful.Client = {
        var clientConfiguration = ClientConfiguration.default
        // The mock server is plain HTTP; both Info.plists allow arbitrary loads.
        clientConfiguration.secure = false

        return Contentful.Client(
            spaceId: AppConfig.contentfulSpaceId,
            environmentId: AppConfig.environment,
            accessToken: AppConfig.contentfulAccessToken,
            host: AppConfig.contentfulHost,
            clientConfiguration: clientConfiguration
        )
    }()

    /// Matches the `include=10` CDA contract: linked entries are resolved by
    /// `contentful.swift` up to ten levels deep.
    private static let includeDepth: UInt = 10

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
            if let entry = await fetchEntry(id: id, locale: locale) {
                entries.append(entry)
            }
        }
        return entries
    }

    private static func fetchEntry(id: String, locale: String) async -> Contentful.Entry? {
        // Single-locale request. Entry resolution expects direct fields such as
        // `fields.nt_experiences`, so all-locale responses must not be used.
        let query = Query.where(sys: .id, .equals(id))
            .include(includeDepth)
            .localizeResults(withLocaleCode: locale)

        // `contentful.swift` 5.5.15 exposes only completion-handler fetches, so
        // this `async` call bridges through a continuation. A failed fetch
        // renders as the loading state, which the offline-behavior suite drives.
        let response: HomogeneousArrayResponse<Contentful.Entry>? = try? await withCheckedThrowingContinuation { continuation in
            client.fetchArray(of: Contentful.Entry.self, matching: query) { result in
                continuation.resume(with: result)
            }
        }
        return response?.items.first
    }
}
