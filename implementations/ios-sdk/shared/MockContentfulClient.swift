import Contentful
import Foundation

/// The demo app's Contentful Delivery API client, shared by every CDA read
/// (home-screen entries and the preview panel's audience/experience fetch).
///
/// A production app constructs the client the same way, minus `host`,
/// `clientConfiguration`, and `sessionConfiguration` — those three exist only to
/// reach the local mock server. See ``MockContentfulTransport``.
enum MockContentfulClient {

    static let shared: Contentful.Client = {
        var clientConfiguration = ClientConfiguration.default
        // The mock server is plain HTTP; both Info.plists allow arbitrary loads.
        clientConfiguration.secure = false

        let sessionConfiguration = URLSessionConfiguration.default
        sessionConfiguration.protocolClasses = [MockContentfulTransport.self]

        return Contentful.Client(
            spaceId: AppConfig.contentfulSpaceId,
            environmentId: AppConfig.environment,
            accessToken: AppConfig.contentfulAccessToken,
            host: AppConfig.contentfulHost,
            clientConfiguration: clientConfiguration,
            sessionConfiguration: sessionConfiguration
        )
    }()

    /// `contentful.swift` 5.5.15 exposes only completion-handler fetches, so the
    /// app's `async` call sites bridge through a continuation.
    static func fetchEntries(matching query: Query) async throws -> HomogeneousArrayResponse<Contentful.Entry> {
        try await withCheckedThrowingContinuation { continuation in
            shared.fetchArray(of: Contentful.Entry.self, matching: query) { result in
                continuation.resume(with: result)
            }
        }
    }
}
