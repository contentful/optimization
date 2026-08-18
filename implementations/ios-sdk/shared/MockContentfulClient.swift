import Contentful
import Foundation

/// The demo app's Contentful Delivery API client, shared by every CDA read
/// (home-screen entries and the preview panel's audience/experience fetch).
///
/// A production app constructs the client the same way, minus `host`,
/// `clientConfiguration`, and `sessionConfiguration` — those three, and the
/// nested ``Transport``, exist only to reach the local mock server.
enum MockContentfulClient {

    static let shared: Contentful.Client = {
        var clientConfiguration = ClientConfiguration.default
        // The mock server is plain HTTP; both Info.plists allow arbitrary loads.
        clientConfiguration.secure = false

        let sessionConfiguration = URLSessionConfiguration.default
        sessionConfiguration.protocolClasses = [Transport.self]

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

    // MARK: - Mock server transport

    /// Adapts `Contentful.Client`'s request URLs to this repo's mock CDA server.
    ///
    /// A production app needs none of this. It builds
    /// `Contentful.Client(spaceId:accessToken:)` against `cdn.contentful.com`,
    /// and every URL the SDK generates is already correct. Two properties of the
    /// *mock* server make the shim necessary here:
    ///
    /// - `lib/mocks` multiplexes the Contentful, Experience, and Insights APIs
    ///   onto one port, namespacing the CDA under `/contentful/`.
    ///   `Contentful.Client` builds `/spaces/...` from the host root and accepts
    ///   only a `host[:port]`, so there is nowhere to put the prefix.
    /// - The SDK walks locale fallback chains itself, so it fetches `/locales`
    ///   before the first `/entries` call and refuses to decode entries without
    ///   the resulting localization context. The mock serves no `/locales` route.
    ///
    /// Installed on ``shared``'s session only, never registered globally, so no
    /// other networking in the app is affected.
    private final class Transport: URLProtocol {

        /// Mirrors `QueryConstants.maxLimit`, the limit the SDK sends for `/locales`.
        private static let localesLimit = 1000

        /// Carries the mock server's own locale set, matching the single default
        /// locale in `lib/mocks/src/contentful/data/space/ctfl-space-data.json`.
        /// `sys` is omitted deliberately: `Contentful.Locale` synthesizes it from
        /// `code` when absent, and `LocalizationContext` only needs exactly one
        /// locale flagged `default`.
        private static let localesPayload: [String: Any] = [
            "sys": ["type": "Array"],
            "total": 1,
            "skip": 0,
            "limit": localesLimit,
            "items": [
                [
                    "name": "English (United States)",
                    "code": AppConfig.defaultContentfulLocale,
                    "fallbackCode": NSNull(),
                    "default": true,
                    "contentDeliveryApi": true,
                    "contentManagementApi": true,
                    "optional": false,
                ],
            ],
        ]

        /// Does not carry this protocol class, which is what keeps forwarded
        /// requests from re-entering `startLoading()`.
        private static let forwardingSession = URLSession(configuration: .ephemeral)

        private var forwardedTask: URLSessionDataTask?

        override class func canInit(with request: URLRequest) -> Bool {
            guard let url = request.url, let host = url.host else { return false }
            let hostWithPort = url.port.map { "\(host):\($0)" } ?? host
            return hostWithPort == AppConfig.contentfulHost && url.path.hasPrefix("/spaces/")
        }

        override class func canonicalRequest(for request: URLRequest) -> URLRequest {
            request
        }

        override func startLoading() {
            guard let url = request.url else {
                client?.urlProtocol(self, didFailWithError: URLError(.badURL))
                return
            }

            if url.lastPathComponent == "locales" {
                serveLocales(for: url)
            } else {
                forwardToMockServer(url)
            }
        }

        override func stopLoading() {
            forwardedTask?.cancel()
            forwardedTask = nil
        }

        // MARK: - Locales

        private func serveLocales(for url: URL) {
            guard let client,
                  let data = try? JSONSerialization.data(withJSONObject: Self.localesPayload),
                  let response = HTTPURLResponse(
                      url: url,
                      statusCode: 200,
                      httpVersion: nil,
                      headerFields: ["Content-Type": "application/json"]
                  )
            else {
                client?.urlProtocol(self, didFailWithError: URLError(.cannotParseResponse))
                return
            }

            client.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client.urlProtocol(self, didLoad: data)
            client.urlProtocolDidFinishLoading(self)
        }

        // MARK: - Prefix rewrite

        private func forwardToMockServer(_ url: URL) {
            guard let prefixed = Self.prefixed(url) else {
                client?.urlProtocol(self, didFailWithError: URLError(.badURL))
                return
            }

            var forwarded = request
            forwarded.url = prefixed

            forwardedTask = Self.forwardingSession.dataTask(with: forwarded) { [weak self] data, response, error in
                guard let self, let client = self.client else { return }

                if let error {
                    client.urlProtocol(self, didFailWithError: error)
                    return
                }
                if let response {
                    client.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                }
                if let data {
                    client.urlProtocol(self, didLoad: data)
                }
                client.urlProtocolDidFinishLoading(self)
            }
            forwardedTask?.resume()
        }

        private static func prefixed(_ url: URL) -> URL? {
            guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
            components.path = AppConfig.contentfulMockPathPrefix + components.path
            return components.url
        }
    }
}
