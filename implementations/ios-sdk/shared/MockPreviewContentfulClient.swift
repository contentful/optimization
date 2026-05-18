import ContentfulOptimization
import Foundation

/// `PreviewContentfulClient` that targets `AppConfig.contentfulBaseUrl`
/// (the local mock server) rather than Contentful's production CDA.
///
/// Mirrors `ContentfulHTTPPreviewClient` in shape but uses the demo app's
/// configured base URL so the preview panel can load audiences and
/// experiences against the mock fixture during E2E tests.
final class MockPreviewContentfulClient: PreviewContentfulClient {
    private let baseUrl: String
    private let spaceId: String
    private let environment: String
    private let accessToken: String
    private let session: URLSession

    init(
        baseUrl: String = AppConfig.contentfulBaseUrl,
        spaceId: String = AppConfig.contentfulSpaceId,
        environment: String = AppConfig.environment,
        accessToken: String = "mock-access-token",
        session: URLSession = .shared
    ) {
        self.baseUrl = baseUrl
        self.spaceId = spaceId
        self.environment = environment
        self.accessToken = accessToken
        self.session = session
    }

    func getEntries(contentType: String, include: Int, skip: Int, limit: Int) async throws -> ContentfulEntriesResult {
        let urlString = "\(baseUrl)spaces/\(spaceId)/environments/\(environment)/entries"
        guard var components = URLComponents(string: urlString) else {
            throw URLError(.badURL)
        }
        components.queryItems = [
            URLQueryItem(name: "content_type", value: contentType),
            URLQueryItem(name: "include", value: String(include)),
            URLQueryItem(name: "skip", value: String(skip)),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        guard let url = components.url else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode)
        else {
            throw URLError(.badServerResponse)
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw URLError(.cannotParseResponse)
        }

        let includesJSON = json["includes"] as? [String: Any]
        let includedEntries = includesJSON?["Entry"] as? [[String: Any]] ?? []

        return ContentfulEntriesResult(
            items: json["items"] as? [[String: Any]] ?? [],
            total: json["total"] as? Int ?? 0,
            skip: json["skip"] as? Int ?? 0,
            limit: json["limit"] as? Int ?? 0,
            includes: ContentfulIncludes(entries: includedEntries)
        )
    }
}
