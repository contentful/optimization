import Foundation

/// A `URLProtocol` subclass that intercepts all HTTP requests and returns canned 200 responses.
/// Used for performance tests to eliminate network dependency while exercising the full URLSession path.
///
/// Usage:
///   StubURLProtocol.register()   // in setUp
///   StubURLProtocol.unregister() // in tearDown
class StubURLProtocol: URLProtocol {

    /// Canned response body returned for all intercepted requests.
    static var stubbedResponseBody: Data = "{\"ok\":true}".data(using: .utf8)!

    /// Canned status code returned for all intercepted requests.
    static var stubbedStatusCode: Int = 200

    /// Register this protocol to intercept requests on `URLSession.shared`.
    static func register() {
        URLProtocol.registerClass(StubURLProtocol.self)
    }

    /// Unregister this protocol.
    static func unregister() {
        URLProtocol.unregisterClass(StubURLProtocol.self)
    }

    // MARK: - URLProtocol Overrides

    override class func canInit(with request: URLRequest) -> Bool {
        return true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://stub.test")!,
            statusCode: StubURLProtocol.stubbedStatusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!

        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: StubURLProtocol.stubbedResponseBody)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {
        // No-op: responses are delivered synchronously in startLoading
    }
}
