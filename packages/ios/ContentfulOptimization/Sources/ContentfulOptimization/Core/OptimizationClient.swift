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

    /// Whether the preview panel is currently open.
    /// When `true`, ``OptimizedEntry`` components switch to live update mode
    /// so that override changes are reflected immediately.
    @Published public private(set) var isPreviewPanelOpen = false

    private let bridge = JSContextManager()
    private var cancellables = Set<AnyCancellable>()
    private let store = UserDefaultsStore()

    #if canImport(UIKit)
    private var appStateHandler: AppStateHandler?
    #endif
    private var networkMonitor: NetworkMonitor?

    private let eventSubject = PassthroughSubject<[String: Any], Never>()

    /// A publisher that emits analytics/personalization events from the JS bridge.
    public var eventPublisher: AnyPublisher<[String: Any], Never> {
        eventSubject.eraseToAnyPublisher()
    }

    private let log = DiagnosticLogger.shared

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
        log.setEnabled(config.debug)
        log.info("[init] Starting SDK initialization (clientId=\(config.clientId), env=\(config.environment))")
        if let url = config.experienceBaseUrl {
            log.debug("[init] experienceBaseUrl=\(url)")
        } else {
            log.debug("[init] experienceBaseUrl=<default>")
        }

        // Load persisted state and merge into config defaults
        store.load()
        var mergedConfig = config
        if mergedConfig.defaults == nil {
            mergedConfig.defaults = StorageDefaults()
        }
        if mergedConfig.defaults?.consent == nil, let storedConsent = store.consent {
            mergedConfig.defaults?.consent = storedConsent
        }
        if mergedConfig.defaults?.profile == nil, let storedProfile = store.profile {
            mergedConfig.defaults?.profile = storedProfile
        }
        if mergedConfig.defaults?.changes == nil, let storedChanges = store.changes {
            mergedConfig.defaults?.changes = storedChanges
        }
        if mergedConfig.defaults?.personalizations == nil, let storedP = store.personalizations {
            mergedConfig.defaults?.personalizations = storedP
        }

        // Wire up JS bridge logging
        bridge.onLog = { [weak self] level, msg in
            self?.log.debug("[js:\(level)] \(msg)")
        }

        try bridge.initialize(config: mergedConfig)
        isInitialized = true
        log.info("[init] SDK initialized successfully")

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
        try await bridgeCallAsyncJSON(method: "identify") {
            var payloadDict: [String: Any] = ["userId": userId]
            if let traits = traits {
                payloadDict["traits"] = traits
            }
            return try serializeJSON(payloadDict)
        }
    }

    /// Track a page view. Returns the server response as a dictionary.
    public func page(properties: [String: Any]? = nil) async throws -> [String: Any]? {
        try await bridgeCallAsyncJSON(method: "page") {
            try serializeJSON(properties ?? [:])
        }
    }

    /// Track a screen view. Returns the server response as a dictionary.
    public func screen(name: String, properties: [String: Any]? = nil) async throws -> [String: Any]? {
        eventSubject.send(["type": "screen", "name": name])
        return try await bridgeCallAsyncJSON(method: "screen") {
            var payloadDict: [String: Any] = ["name": name]
            if let properties = properties {
                payloadDict["properties"] = properties
            }
            return try serializeJSON(payloadDict)
        }
    }

    /// Flush pending analytics and personalization events.
    public func flush() async throws {
        try await bridgeCallAsyncVoid(method: "flush", payload: "")
    }

    /// Track a view event. Returns the server response as a dictionary.
    public func trackView(_ payload: TrackViewPayload) async throws -> [String: Any]? {
        try await bridgeCallAsyncJSON(method: "trackView") {
            try payload.toJSON()
        }
    }

    /// Track a click event. Returns the server response as a dictionary.
    public func trackClick(_ payload: TrackClickPayload) async throws -> [String: Any]? {
        try await bridgeCallAsyncJSON(method: "trackClick") {
            try payload.toJSON()
        }
    }

    /// Set the consent state.
    public func consent(_ accept: Bool) {
        bridgeCallSyncWhenInitialized(method: "consent", args: accept ? "true" : "false")
    }

    /// Reset the SDK state (clears profile, changes, selected personalizations).
    public func reset() {
        guard isInitialized else { return }
        bridgeCallSyncWhenInitialized(method: "reset")
        store.clear()
    }

    /// Set the online/offline state.
    public func setOnline(_ isOnline: Bool) {
        bridgeCallSyncWhenInitialized(method: "setOnline", args: isOnline ? "true" : "false")
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

            guard let result = bridgeCallSyncWhenInitialized(method: "personalizeEntry", args: args),
                  !result.isNull && !result.isUndefined,
                  let str = result.toString(),
                  let data = str.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                let entryId = (baseline["sys"] as? [String: Any])?["id"] as? String ?? "unknown"
                log.warning("[personalize] Failed to parse bridge result for entry \(entryId)")
                return PersonalizedResult(entry: baseline, personalization: nil)
            }

            let entry = dict["entry"] as? [String: Any] ?? baseline
            let personalization = dict["personalization"] as? [String: Any]
            return PersonalizedResult(entry: entry, personalization: personalization)
        } catch {
            let entryId = (baseline["sys"] as? [String: Any])?["id"] as? String ?? "unknown"
            log.error("[personalize] Serialization error for entry \(entryId): \(error.localizedDescription)")
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

    // MARK: - Preview Panel

    /// Set the preview panel open state.
    ///
    /// When `open` is `true`, ``OptimizedEntry`` components switch to live update mode
    /// so that audience and variant overrides are reflected immediately.
    public func setPreviewPanelOpen(_ open: Bool) {
        isPreviewPanelOpen = open
        bridgeCallSyncWhenInitialized(method: "setPreviewPanelOpen", args: open ? "true" : "false")
    }

    /// Override an audience's qualification state.
    public func overrideAudience(id: String, qualified: Bool) {
        let escapedId = NativePolyfills.escapeForJS(id)
        bridgeCallSyncWhenInitialized(method: "overrideAudience", args: "'\(escapedId)', \(qualified)")
    }

    /// Override a variant for a specific experience.
    public func overrideVariant(experienceId: String, variantIndex: Int) {
        let escapedId = NativePolyfills.escapeForJS(experienceId)
        bridgeCallSyncWhenInitialized(method: "overrideVariant", args: "'\(escapedId)', \(variantIndex)")
    }

    /// Reset a single audience override back to its natural state.
    public func resetAudienceOverride(id: String) {
        let escapedId = NativePolyfills.escapeForJS(id)
        bridgeCallSyncWhenInitialized(method: "resetAudienceOverride", args: "'\(escapedId)'")
    }

    /// Reset a single variant override back to its natural state.
    public func resetVariantOverride(experienceId: String) {
        let escapedId = NativePolyfills.escapeForJS(experienceId)
        bridgeCallSyncWhenInitialized(method: "resetVariantOverride", args: "'\(escapedId)'")
    }

    /// Reset all audience and variant overrides back to their natural state.
    public func resetAllOverrides() {
        bridgeCallSyncWhenInitialized(method: "resetAllOverrides")
    }

    /// Get the current preview state as a typed snapshot.
    public func getPreviewState() -> PreviewState? {
        guard let result = bridge.callSync(method: "getPreviewState"),
              !result.isNull && !result.isUndefined,
              let str = result.toString(),
              let data = str.data(using: .utf8)
        else {
            log.warning("[preview] getPreviewState returned nil")
            return nil
        }
        do {
            let state = try JSONDecoder().decode(PreviewState.self, from: data)
            let hasProfile = state.profile?.objectValue != nil
            log.debug("[preview] getPreviewState: profile=\(hasProfile ? "present" : "nil"), canPersonalize=\(state.canPersonalize)")
            return state
        } catch {
            log.warning("[preview] Failed to decode preview state: \(error.localizedDescription)")
            return nil
        }
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
        store.clear()
    }

    // MARK: - Testing

    /// Test-only hook to observe bridge log messages (including JS exceptions).
    /// Not part of the public API contract.
    public func testOnlySetLogHandler(_ handler: @escaping (String, String) -> Void) {
        bridge.onLog = { [weak self] level, msg in
            self?.log.debug("[js:\(level)] \(msg)")
            handler(level, msg)
        }
    }

    /// Test-only: evaluate a JS script in the bridge context. Returns the string result.
    /// Not part of the public API contract.
    @discardableResult
    public func testOnlyEvaluateScript(_ script: String) -> String? {
        bridge.context?.evaluateScript(script)?.toString()
    }

    // MARK: - Private

    private func requireInitialized() throws {
        guard isInitialized else { throw OptimizationError.notInitialized }
    }

    @discardableResult
    private func bridgeCallSyncWhenInitialized(method: String, args: String = "") -> JSValue? {
        guard isInitialized else { return nil }
        return bridge.callSync(method: method, args: args)
    }

    private func bridgeCallAsyncJSON(
        method: String,
        buildPayload: () throws -> String
    ) async throws -> [String: Any]? {
        try requireInitialized()
        let payload = try buildPayload()
        log.debug("[bridge] Calling \(method) async")
        return try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: method, payload: payload) { [weak self] result in
                switch result {
                case .success(let json):
                    self?.log.debug("[bridge] \(method) succeeded (\(json.prefix(200)))")
                    continuation.resume(returning: Self.parseJSONDict(json))
                case .failure(let error):
                    self?.log.error("[bridge] \(method) failed: \(error.localizedDescription)")
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func bridgeCallAsyncVoid(method: String, payload: String) async throws {
        try requireInitialized()
        try await withCheckedThrowingContinuation { continuation in
            bridge.callAsync(method: method, payload: payload) { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func handleStateUpdate(_ dict: [String: Any]) {
        let profile = Self.extractJSONValue(dict["profile"])
        let changes = Self.extractJSONValue(dict["changes"])
        let consent = dict["consent"] as? Bool

        if let profile = profile {
            log.info("[state] Profile updated with \(profile.keys.sorted().joined(separator: ", "))")
        } else {
            log.debug("[state] State update received (profile=nil, consent=\(consent.map(String.init) ?? "nil"), canPersonalize=\(dict["canPersonalize"] as? Bool ?? false))")
        }

        state = OptimizationState(
            profile: profile,
            consent: consent,
            canPersonalize: dict["canPersonalize"] as? Bool ?? false,
            changes: changes
        )

        let personalizations = Self.extractJSONArray(dict["selectedPersonalizations"])
        self.selectedPersonalizations = personalizations

        if let changes = changes {
            log.debug("[state] Changes: \(changes.keys.count) entries")
        }
        if let personalizations = personalizations {
            log.debug("[state] Personalizations: \(personalizations.count) entries")
        }

        // Persist state to storage
        store.profile = profile
        store.consent = consent
        store.changes = changes
        store.personalizations = personalizations
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
              let data = json.data(using: .utf8)
        else { return nil }
        do {
            guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                DiagnosticLogger.shared.warning("[parse] JSON is not a dictionary: \(json.prefix(200))")
                return nil
            }
            return dict
        } catch {
            DiagnosticLogger.shared.warning("[parse] JSON parse failed: \(error.localizedDescription) — input: \(json.prefix(200))")
            return nil
        }
    }

    private func serializeJSON(_ value: Any) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: value)
        guard let str = String(data: data, encoding: .utf8) else {
            throw OptimizationError.configError("Failed to serialize JSON payload")
        }
        return str
    }
}
