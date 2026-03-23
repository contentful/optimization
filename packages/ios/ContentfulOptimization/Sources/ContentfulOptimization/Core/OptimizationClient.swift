import Combine
import Foundation
import JavaScriptCore

/// The main public entry point for the Contentful Optimization SDK.
///
/// `OptimizationClient` is an `ObservableObject` that wraps the JavaScript bridge
/// and exposes reactive state via `@Published` properties.
///
/// Usage:
/// ```swift
/// let client = OptimizationClient()
/// try await client.initialize(config: OptimizationConfig(
///     clientId: "my-client-id",
///     environment: "master",
///     experienceBaseUrl: "https://example.com/experience/",
///     insightsBaseUrl: "https://example.com/insights/"
/// ))
/// ```
@MainActor
public final class OptimizationClient: ObservableObject {

    /// The current bridge state (profile, consent, canPersonalize, changes).
    @Published public private(set) var state = OptimizationState.empty

    /// Whether the SDK has been successfully initialized.
    @Published public private(set) var isInitialized = false

    private let bridge = JSContextManager()
    private var cancellables = Set<AnyCancellable>()

    public init() {
        bridge.onStateChange = { [weak self] dict in
            self?.handleStateUpdate(dict)
        }
    }

    // MARK: - Public API

    /// Initialize the SDK with the given configuration.
    public func initialize(config: OptimizationConfig) throws {
        try bridge.initialize(config: config)
        isInitialized = true
    }

    /// Identify a user. Returns the server response as a dictionary.
    public func identify(
        userId: String,
        traits: [String: Any]? = nil
    ) async throws -> [String: Any]? {
        guard isInitialized else { throw OptimizationError.notInitialized }

        var payloadDict: [String: Any] = ["userId": userId]
        if let traits = traits {
            payloadDict["traits"] = traits
        }
        let payloadJSON = try serializeJSON(payloadDict)

        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: "identify", payload: payloadJSON) { result in
                switch result {
                case .success(let json):
                    continuation.resume(returning: Self.parseJSONDict(json))
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Track a page view. Returns the server response as a dictionary.
    public func page(properties: [String: Any]? = nil) async throws -> [String: Any]? {
        guard isInitialized else { throw OptimizationError.notInitialized }

        let payload = try serializeJSON(properties ?? [:])

        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: "page", payload: payload) { result in
                switch result {
                case .success(let json):
                    continuation.resume(returning: Self.parseJSONDict(json))
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Get the current profile synchronously.
    public func getProfile() -> [String: Any]? {
        guard let result = bridge.callSync(method: "getProfile"),
              !result.isNull && !result.isUndefined,
              let str = result.toString()
        else { return nil }
        return Self.parseJSONDict(str)
    }

    /// Get the current state synchronously.
    public func getState() -> OptimizationState {
        return state
    }

    /// Destroy the SDK instance and release all resources.
    public func destroy() {
        bridge.destroy()
        isInitialized = false
        state = .empty
    }

    // MARK: - Private

    private func handleStateUpdate(_ dict: [String: Any]) {
        let profile = Self.extractJSONValue(dict["profile"])
        let changes = Self.extractJSONValue(dict["changes"])

        state = OptimizationState(
            profile: profile,
            consent: dict["consent"] as? Bool,
            canPersonalize: dict["canPersonalize"] as? Bool ?? false,
            changes: changes
        )
    }

    /// Extracts a JSON-compatible dictionary from a value that may be NSNull, nil, or a dict.
    private static func extractJSONValue(_ value: Any?) -> [String: Any]? {
        guard let value = value, !(value is NSNull) else { return nil }
        return value as? [String: Any]
    }

    private static func parseJSONDict(_ json: String) -> [String: Any]? {
        guard json != "null",
              let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return dict
    }

    private func serializeJSON(_ value: Any) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: value)
        guard let str = String(data: data, encoding: .utf8) else {
            throw OptimizationError.configError("Failed to serialize JSON payload")
        }
        return str
    }
}
