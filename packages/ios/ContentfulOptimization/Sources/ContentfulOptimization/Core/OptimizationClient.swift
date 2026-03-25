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

    /// The currently selected personalizations, updated reactively from JS signals.
    @Published public private(set) var selectedPersonalizations: [[String: Any]]?

    private let bridge = JSContextManager()
    private var cancellables = Set<AnyCancellable>()

    #if canImport(UIKit)
    private var appStateHandler: AppStateHandler?
    #endif
    private var networkMonitor: NetworkMonitor?

    private let eventSubject = PassthroughSubject<[String: Any], Never>()

    /// A publisher that emits analytics/personalization events from the JS bridge.
    public var eventPublisher: AnyPublisher<[String: Any], Never> {
        eventSubject.eraseToAnyPublisher()
    }

    public init() {
        bridge.onStateChange = { [weak self] dict in
            self?.handleStateUpdate(dict)
        }
        bridge.onEvent = { [weak self] dict in
            self?.eventSubject.send(dict)
        }
    }

    // MARK: - Public API

    /// Initialize the SDK with the given configuration.
    public func initialize(config: OptimizationConfig) throws {
        try bridge.initialize(config: config)
        isInitialized = true

        // Start platform handlers
        #if canImport(UIKit)
        appStateHandler = AppStateHandler(client: self)
        #endif
        networkMonitor = NetworkMonitor(client: self)
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

    /// Track a screen view. Returns the server response as a dictionary.
    public func screen(name: String, properties: [String: Any]? = nil) async throws -> [String: Any]? {
        guard isInitialized else { throw OptimizationError.notInitialized }

        var payloadDict: [String: Any] = ["name": name]
        if let properties = properties {
            payloadDict["properties"] = properties
        }
        let payloadJSON = try serializeJSON(payloadDict)

        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: "screen", payload: payloadJSON) { result in
                switch result {
                case .success(let json):
                    continuation.resume(returning: Self.parseJSONDict(json))
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Flush pending analytics and personalization events.
    public func flush() async throws {
        guard isInitialized else { throw OptimizationError.notInitialized }

        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: "flush", payload: "") { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Track a view event. Returns the server response as a dictionary.
    public func trackView(_ payload: TrackViewPayload) async throws -> [String: Any]? {
        guard isInitialized else { throw OptimizationError.notInitialized }

        let payloadJSON = try payload.toJSON()

        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: "trackView", payload: payloadJSON) { result in
                switch result {
                case .success(let json):
                    continuation.resume(returning: Self.parseJSONDict(json))
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Track a click event. Returns the server response as a dictionary.
    public func trackClick(_ payload: TrackClickPayload) async throws -> [String: Any]? {
        guard isInitialized else { throw OptimizationError.notInitialized }

        let payloadJSON = try payload.toJSON()

        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: "trackClick", payload: payloadJSON) { result in
                switch result {
                case .success(let json):
                    continuation.resume(returning: Self.parseJSONDict(json))
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Set the consent state.
    public func consent(_ accept: Bool) {
        guard isInitialized else { return }
        bridge.callSync(method: "consent", args: accept ? "true" : "false")
    }

    /// Reset the SDK state (clears profile, changes, selected personalizations).
    public func reset() {
        guard isInitialized else { return }
        bridge.callSync(method: "reset")
    }

    /// Set the online/offline state.
    public func setOnline(_ isOnline: Bool) {
        guard isInitialized else { return }
        bridge.callSync(method: "setOnline", args: isOnline ? "true" : "false")
    }

    /// Personalize a Contentful entry using the current personalization state.
    public func personalizeEntry(
        baseline: [String: Any],
        personalizations: [[String: Any]]? = nil
    ) -> PersonalizedResult {
        guard isInitialized else {
            return PersonalizedResult(entry: baseline, personalization: nil)
        }

        do {
            let baselineJSON = try serializeJSON(baseline)
            var args = baselineJSON
            if let personalizations = personalizations {
                let pJSON = try serializeJSON(personalizations)
                args = "\(baselineJSON), \(pJSON)"
            }

            guard let result = bridge.callSync(method: "personalizeEntry", args: args),
                  !result.isNull && !result.isUndefined,
                  let str = result.toString(),
                  let data = str.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                return PersonalizedResult(entry: baseline, personalization: nil)
            }

            let entry = dict["entry"] as? [String: Any] ?? baseline
            let personalization = dict["personalization"] as? [String: Any]
            return PersonalizedResult(entry: entry, personalization: personalization)
        } catch {
            return PersonalizedResult(entry: baseline, personalization: nil)
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
        #if canImport(UIKit)
        appStateHandler?.stop()
        appStateHandler = nil
        #endif
        networkMonitor?.stop()
        networkMonitor = nil

        bridge.destroy()
        isInitialized = false
        state = .empty
        selectedPersonalizations = nil
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

        self.selectedPersonalizations = Self.extractJSONArray(dict["selectedPersonalizations"])
    }

    /// Extracts a JSON-compatible dictionary from a value that may be NSNull, nil, or a dict.
    private static func extractJSONValue(_ value: Any?) -> [String: Any]? {
        guard let value = value, !(value is NSNull) else { return nil }
        return value as? [String: Any]
    }

    /// Extracts a JSON-compatible array of dictionaries from a value that may be NSNull, nil, or an array.
    private static func extractJSONArray(_ value: Any?) -> [[String: Any]]? {
        guard let value = value, !(value is NSNull) else { return nil }
        return value as? [[String: Any]]
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
