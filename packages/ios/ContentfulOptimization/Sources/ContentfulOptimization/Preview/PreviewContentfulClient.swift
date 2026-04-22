import Foundation

// MARK: - Protocol

/// Protocol for a Contentful Delivery API client used by the preview panel.
///
/// Implement this protocol to provide audience and experience definitions
/// from your Contentful space, enabling rich preview panel features like
/// experience names, types, variant names, and traffic percentages.
///
/// Use the built-in ``ContentfulHTTPPreviewClient`` for a simple implementation,
/// or implement this protocol to wrap your existing Contentful SDK client.
public protocol PreviewContentfulClient {
    /// Fetch entries from the Contentful Delivery API.
    ///
    /// - Parameters:
    ///   - contentType: The content type ID to filter by (e.g., `nt_audience`, `nt_experience`).
    ///   - include: The number of levels of linked entries to resolve.
    ///   - skip: The number of entries to skip (for pagination).
    ///   - limit: The maximum number of entries to return.
    /// - Returns: A result containing the entries and pagination information.
    func getEntries(contentType: String, include: Int, skip: Int, limit: Int) async throws -> ContentfulEntriesResult
}

// MARK: - Response Types

/// Result of a Contentful entries query.
public struct ContentfulEntriesResult {
    /// The array of entry objects.
    public let items: [[String: Any]]
    /// The total number of entries matching the query.
    public let total: Int
    /// The number of entries skipped.
    public let skip: Int
    /// The maximum number of entries returned.
    public let limit: Int
    /// Linked entries resolved via the `include` parameter.
    public let includes: ContentfulIncludes

    public init(items: [[String: Any]], total: Int, skip: Int, limit: Int, includes: ContentfulIncludes = ContentfulIncludes()) {
        self.items = items
        self.total = total
        self.skip = skip
        self.limit = limit
        self.includes = includes
    }
}

/// Linked/included entries from a Contentful response.
public struct ContentfulIncludes {
    /// Included Entry objects.
    public let entries: [[String: Any]]

    public init(entries: [[String: Any]] = []) {
        self.entries = entries
    }
}

// MARK: - HTTP Implementation

/// A simple HTTP-based Contentful Delivery API client using URLSession.
///
/// Initialize with your Contentful space credentials:
/// ```swift
/// let client = ContentfulHTTPPreviewClient(
///     spaceId: "your-space-id",
///     accessToken: "your-cda-token",
///     environment: "master"
/// )
/// ```
public final class ContentfulHTTPPreviewClient: PreviewContentfulClient {
    private let spaceId: String
    private let accessToken: String
    private let environment: String
    private let session: URLSession

    public init(spaceId: String, accessToken: String, environment: String = "master", session: URLSession = .shared) {
        self.spaceId = spaceId
        self.accessToken = accessToken
        self.environment = environment
        self.session = session
    }

    public func getEntries(contentType: String, include: Int, skip: Int, limit: Int) async throws -> ContentfulEntriesResult {
        var components = URLComponents(string: "https://cdn.contentful.com/spaces/\(spaceId)/environments/\(environment)/entries")!
        components.queryItems = [
            URLQueryItem(name: "content_type", value: contentType),
            URLQueryItem(name: "include", value: String(include)),
            URLQueryItem(name: "skip", value: String(skip)),
            URLQueryItem(name: "limit", value: String(limit)),
        ]

        guard let url = components.url else {
            throw ContentfulPreviewError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ContentfulPreviewError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw ContentfulPreviewError.httpError(statusCode: httpResponse.statusCode)
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ContentfulPreviewError.invalidJSON
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

// MARK: - Errors

public enum ContentfulPreviewError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case invalidJSON

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid Contentful API URL"
        case .invalidResponse: return "Invalid response from Contentful API"
        case .httpError(let code): return "Contentful API returned HTTP \(code)"
        case .invalidJSON: return "Failed to parse Contentful API response"
        }
    }
}

// MARK: - Batch Fetching

private let batchSize = 100

/// Fetches all entries of a given content type, handling pagination automatically.
func fetchAllEntries(client: PreviewContentfulClient, contentType: String, include: Int = 10) async throws -> ContentfulEntriesResult {
    var allItems: [[String: Any]] = []
    var allIncludes: [[String: Any]] = []
    var skip = 0
    var total = 0

    repeat {
        let result = try await client.getEntries(contentType: contentType, include: include, skip: skip, limit: batchSize)
        allItems.append(contentsOf: result.items)
        allIncludes.append(contentsOf: result.includes.entries)
        total = result.total
        skip += result.items.count
    } while skip < total

    return ContentfulEntriesResult(
        items: allItems,
        total: total,
        skip: 0,
        limit: allItems.count,
        includes: ContentfulIncludes(entries: allIncludes)
    )
}

/// Fetches audience and experience entries in parallel.
func fetchAudienceAndExperienceEntries(client: PreviewContentfulClient) async throws -> (audiences: ContentfulEntriesResult, experiences: ContentfulEntriesResult) {
    async let audienceResult = fetchAllEntries(client: client, contentType: "nt_audience")
    async let experienceResult = fetchAllEntries(client: client, contentType: "nt_experience", include: 10)
    return try await (audiences: audienceResult, experiences: experienceResult)
}
