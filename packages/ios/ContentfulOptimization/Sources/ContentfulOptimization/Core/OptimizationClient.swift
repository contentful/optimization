import Combine
import Foundation
import JavaScriptCore

public struct EventEmissionResult {
    public let accepted: Bool
    public let data: [String: Any]?

    public init(accepted: Bool, data: [String: Any]? = nil) {
        self.accepted = accepted
        self.data = data
    }
}

private extension Optional where Wrapped == [String: Any] {
    func toEventEmissionResult() -> EventEmissionResult {
        EventEmissionResult(
            accepted: self?["accepted"] as? Bool ?? false,
            data: self?["data"] as? [String: Any]
        )
    }
}

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
///     environment: "main",
///     api: OptimizationApiConfig(
///         experienceBaseUrl: "https://example.com/experience/",
///         insightsBaseUrl: "https://example.com/insights/"
///     )
/// ))
/// ```
@MainActor
public final class OptimizationClient: ObservableObject {

    /// The current bridge state (profile, consent, canOptimize, changes).
    @Published public private(set) var state = OptimizationState.empty

    /// Whether the SDK has been successfully initialized.
    @Published public private(set) var isInitialized = false

    /// Current SDK locale for Experience API requests and event context.
    @Published public private(set) var locale: String? = nil

    /// The currently selected optimizations, updated reactively from JS signals.
    @Published public private(set) var selectedOptimizations: [[String: Any]]?

    /// Whether the current consent and allow-list configuration can produce optimizations.
    @Published public private(set) var optimizationPossible = false

    /// Outcome of the most recent Experience API request.
    @Published public private(set) var experienceRequestState: [String: Any] = ["status": "idle"]

    /// Whether the preview panel is currently open.
    /// When `true`, ``OptimizedEntry`` components switch to live update mode
    /// so that override changes are reflected immediately.
    @Published public private(set) var isPreviewPanelOpen = false

    /// The latest preview state pushed from the JS bridge whenever
    /// `PreviewOverrideManager` mutates overrides. Mirrors the React Native
    /// `useProfileOverrides` push model: consumers observe this publisher
    /// rather than polling ``getPreviewState()`` after each action.
    @Published public private(set) var previewState: PreviewState?

    private let bridge = JSContextManager()
    private var cancellables = Set<AnyCancellable>()
    private let store = UserDefaultsStore()

    #if canImport(UIKit)
    private var appStateHandler: AppStateHandler?
    #endif
    private var networkMonitor: NetworkMonitor?

    private let eventSubject = PassthroughSubject<[String: Any], Never>()
    private let blockedEventSubject = PassthroughSubject<BlockedEvent, Never>()
    private var flagSubjects: [String: CurrentValueSubject<JSONValue?, Never>] = [:]
    private var flagSubscriptionIdsByName: [String: String] = [:]
    private var flagNamesBySubscriptionId: [String: String] = [:]

    /// A publisher that emits analytics and optimization events from the JS bridge.
    public var eventStream: AnyPublisher<[String: Any], Never> {
        eventSubject.eraseToAnyPublisher()
    }

    /// A publisher that emits events blocked by consent or SDK guard logic.
    public var blockedEventStream: AnyPublisher<BlockedEvent, Never> {
        blockedEventSubject.eraseToAnyPublisher()
    }

    private let log = DiagnosticLogger.shared

    public init() {
        bridge.onStateChange = { [weak self] dict in
            self?.handleStateUpdate(dict)
        }
        bridge.onEvent = { [weak self] dict in
            self?.eventSubject.send(dict)
        }
        bridge.onFlagValueChanged = { [weak self] subscriptionId, value in
            guard let self, let name = self.flagNamesBySubscriptionId[subscriptionId] else { return }
            self.flagSubjects[name]?.send(value)
        }
        bridge.onOverridesChanged = { [weak self] state in
            self?.previewState = state
        }
    }

    // MARK: - Public API

    /// Initialize the SDK with the given configuration.
    public func initialize(config: OptimizationConfig) throws {
        log.setLevel(config.logLevel)
        log.info("[init] Starting SDK initialization (clientId=\(config.clientId), env=\(config.environment))")
        if let url = config.api?.experienceBaseUrl {
            log.debug("[init] experienceBaseUrl=\(url)")
        } else {
            log.debug("[init] experienceBaseUrl=<default>")
        }

        // Load consent state before touching profile-continuity storage.
        store.loadConsentState()
        clearFlagObservers()
        var mergedConfig = config
        let persistedConsentDefaults = StorageDefaults(
            consent: store.consent,
            persistenceConsent: store.persistenceConsent
        )
        let initialDefaults = resolveStatefulDefaults(
            configured: config.defaults,
            persisted: persistedConsentDefaults
        )
        let storedAnonymousId: String?
        let persistedDefaults: StorageDefaults
        if initialDefaults.canLoadPersistedContinuity {
            store.loadProfileContinuity()
            storedAnonymousId = store.anonymousId
            persistedDefaults = StorageDefaults(
                consent: store.consent,
                persistenceConsent: store.persistenceConsent,
                profile: store.profile,
                changes: store.changes,
                selectedOptimizations: store.selectedOptimizations
            )
        } else {
            storedAnonymousId = nil
            if initialDefaults.defaults.persistenceConsent == false {
                store.clearProfileContinuity()
            }
            persistedDefaults = persistedConsentDefaults
        }
        mergedConfig.defaults = resolveStatefulDefaults(
            configured: config.defaults,
            persisted: persistedDefaults
        ).defaults
        locale = try mergedConfig.normalizedLocale()

        // Wire up JS bridge logging
        bridge.onLog = { [weak self] level, msg in
            self?.log.debug("[js:\(level)] \(msg)")
        }
        bridge.onEventBlocked = { [weak self] event in
            self?.blockedEventSubject.send(event)
            config.onEventBlocked?(event)
        }
        bridge.onQueueEvent = { event in
            switch event.type {
            case .offlineDrop:
                config.queuePolicy?.onOfflineDrop?(event)
            case .flushFailure:
                config.queuePolicy?.onFlushFailure?(event)
            case .circuitOpen:
                config.queuePolicy?.onCircuitOpen?(event)
            case .flushRecovered:
                config.queuePolicy?.onFlushRecovered?(event)
            }
        }

        try bridge.initialize(config: mergedConfig, anonymousId: storedAnonymousId)
        isInitialized = true
        log.info("[init] SDK initialized successfully")

        // Start platform handlers
        #if canImport(UIKit)
        appStateHandler = AppStateHandler(client: self)
        #endif
        networkMonitor = NetworkMonitor(client: self)
    }

    /// Identify a user. Returns the server response as a dictionary.
    public func identify(_ payload: IdentifyPayload) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "identify") {
            try payload.toJSON()
        }.toEventEmissionResult()
    }

    /// Identify a user. Returns the server response as a dictionary.
    public func identify(
        userId: String,
        traits: [String: Any]? = nil
    ) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "identify") {
            var payloadDict: [String: Any] = ["userId": userId]
            if let traits = traits {
                payloadDict["traits"] = traits
            }
            return try serializeJSON(payloadDict)
        }.toEventEmissionResult()
    }

    /// Track a page view. Returns the server response as a dictionary.
    public func page(_ payload: PageEventPayload) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "page") {
            try payload.toJSON()
        }.toEventEmissionResult()
    }

    /// Track a page view. Returns the server response as a dictionary.
    public func page(properties: [String: Any]? = nil) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "page") {
            try serializeJSON(properties ?? [:])
        }.toEventEmissionResult()
    }

    /// Track a screen view. Returns the server response as a dictionary.
    public func screen(_ payload: ScreenEventPayload) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "screen") {
            try payload.toJSON()
        }.toEventEmissionResult()
    }

    /// Track a screen view. Returns the server response as a dictionary.
    public func screen(name: String, properties: [String: Any]? = nil) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "screen") {
            var payloadDict: [String: Any] = ["name": name]
            if let properties = properties {
                payloadDict["properties"] = properties
            }
            return try serializeJSON(payloadDict)
        }.toEventEmissionResult()
    }

    /// Track a custom business event. Returns the server response as a dictionary.
    public func track(_ payload: TrackEventPayload) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "track") {
            try payload.toJSON()
        }.toEventEmissionResult()
    }

    /// Track a custom business event. Returns the server response as a dictionary.
    public func track(event: String, properties: [String: Any]? = nil) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "track") {
            var payloadDict: [String: Any] = ["event": event]
            if let properties = properties {
                payloadDict["properties"] = properties
            }
            return try serializeJSON(payloadDict)
        }.toEventEmissionResult()
    }

    /// Track the current screen with bridge-owned deduplication and retry after blocked attempts.
    public func trackCurrentScreen(_ payload: ScreenEventPayload) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "trackCurrentScreen") {
            try payload.toJSON()
        }.toEventEmissionResult()
    }

    /// Track the current screen with bridge-owned deduplication and retry after blocked attempts.
    public func trackCurrentScreen(
        name: String,
        properties: [String: Any]? = nil,
        routeKey: String? = nil
    ) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "trackCurrentScreen") {
            var payloadDict: [String: Any] = ["name": name]
            payloadDict["routeKey"] = routeKey ?? name
            if let properties = properties {
                payloadDict["properties"] = properties
            }
            return try serializeJSON(payloadDict)
        }.toEventEmissionResult()
    }

    /// Flush pending analytics and optimization events.
    public func flush() async throws {
        try await bridgeCallAsyncVoid(method: "flush", payload: "")
    }

    /// Track a view event. Returns the server response as a dictionary.
    public func trackView(_ payload: TrackViewPayload) async throws -> EventEmissionResult {
        try await bridgeCallAsyncJSON(method: "trackView") {
            try payload.toJSON()
        }.toEventEmissionResult()
    }

    /// Track a click event.
    public func trackClick(_ payload: TrackClickPayload) async throws {
        try await bridgeCallAsyncVoid(method: "trackClick", payload: try payload.toJSON())
    }

    /// Set the consent state.
    public func consent(_ accept: Bool) {
        bridgeCallSyncWhenInitialized(method: "consent", args: accept ? "true" : "false")
    }

    /// Set event and profile-continuity persistence consent independently.
    public func consent(events: Bool? = nil, persistence: Bool? = nil) {
        var fields: [String] = []
        if let events {
            fields.append("events: \(events ? "true" : "false")")
        }
        if let persistence {
            fields.append("persistence: \(persistence ? "true" : "false")")
        }
        bridgeCallSyncWhenInitialized(method: "consent", args: "{\(fields.joined(separator: ","))}")
    }

    /// Reset the SDK state (clears profile, changes, selected optimizations).
    public func reset() {
        guard isInitialized else { return }
        bridgeCallSyncWhenInitialized(method: "reset")
        store.clearProfileContinuity()
    }

    /// Set the online/offline state.
    public func setOnline(_ isOnline: Bool) {
        bridgeCallSyncWhenInitialized(method: "setOnline", args: isOnline ? "true" : "false")
    }

    /// Update the SDK locale used for future Experience API requests and event context.
    @discardableResult
    public func setLocale(_ locale: String) throws -> String? {
        try requireInitialized()
        let escaped = NativePolyfills.escapeForJS(locale)

        guard let result = bridge.callSync(method: "setLocale", args: "'\(escaped)'"),
              !result.isUndefined
        else {
            throw OptimizationError.configError("Failed to update locale")
        }

        let sdkLocale = result.isNull ? nil : result.toString()
        self.locale = sdkLocale
        return sdkLocale
    }

    /// Resolve a Contentful entry using the current selected optimization state.
    public func resolveOptimizedEntry(
        baseline: [String: Any],
        selectedOptimizations: [[String: Any]]? = nil
    ) -> ResolvedOptimizedEntry {
        guard isInitialized else {
            return ResolvedOptimizedEntry(
                entry: baseline,
                selectedOptimization: nil,
                optimizationContextId: nil
            )
        }

        do {
            let baselineJSON = try serializeJSON(baseline)
            var args = baselineJSON
            if let selectedOptimizations {
                let selectedOptimizationsJSON = try serializeJSON(selectedOptimizations)
                args = "\(baselineJSON), \(selectedOptimizationsJSON)"
            }

            guard let result = bridgeCallSyncWhenInitialized(method: "resolveOptimizedEntry", args: args),
                  !result.isNull && !result.isUndefined,
                  let str = result.toString(),
                  let data = str.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                let entryId = (baseline["sys"] as? [String: Any])?["id"] as? String ?? "unknown"
                log.warning("[resolveOptimizedEntry] Failed to parse bridge result for entry \(entryId)")
                return ResolvedOptimizedEntry(
                    entry: baseline,
                    selectedOptimization: nil,
                    optimizationContextId: nil
                )
            }

            let entry = dict["entry"] as? [String: Any] ?? baseline
            let selectedOptimization = dict["selectedOptimization"] as? [String: Any]
            let optimizationContextId = dict["optimizationContextId"] as? String
            return ResolvedOptimizedEntry(
                entry: entry,
                selectedOptimization: selectedOptimization,
                optimizationContextId: optimizationContextId
            )
        } catch {
            let entryId = (baseline["sys"] as? [String: Any])?["id"] as? String ?? "unknown"
            log.error("[resolveOptimizedEntry] Serialization error for entry \(entryId): \(error.localizedDescription)")
            return ResolvedOptimizedEntry(
                entry: baseline,
                selectedOptimization: nil,
                optimizationContextId: nil
            )
        }
    }

    /// Resolve a merge-tag entry's display value against the current profile.
    ///
    /// Pass the resolved `nt_mergetag` entry (the `embedded-entry-inline` node's
    /// expanded `data.target`). Returns the resolved string, or `nil` when the
    /// merge tag cannot be resolved against the current profile.
    public func getMergeTagValue(mergeTagEntry: [String: Any]) -> String? {
        guard isInitialized else { return nil }
        do {
            let json = try serializeJSON(mergeTagEntry)
            guard let result = bridgeCallSyncWhenInitialized(method: "getMergeTagValue", args: json),
                  !result.isNull, !result.isUndefined,
                  let str = result.toString()
            else { return nil }
            return str
        } catch {
            return nil
        }
    }

    /// Resolve a feature flag value by name.
    public func getFlag(_ name: String) -> JSONValue? {
        guard isInitialized else { return nil }
        let escaped = NativePolyfills.escapeForJS(name)
        guard let result = bridgeCallSyncWhenInitialized(method: "getFlag", args: "'\(escaped)'"),
              !result.isUndefined,
              let str = result.toString()
        else { return nil }
        return Self.parseJSONValue(str)
    }

    /// Observe a feature flag value by name.
    public func flagPublisher(_ name: String) -> AnyPublisher<JSONValue?, Never> {
        if let subject = flagSubjects[name] {
            return subject.eraseToAnyPublisher()
        }

        let subject = CurrentValueSubject<JSONValue?, Never>(nil)
        flagSubjects[name] = subject

        guard isInitialized else {
            return subject.eraseToAnyPublisher()
        }

        let subscriptionId = UUID().uuidString
        flagSubscriptionIdsByName[name] = subscriptionId
        flagNamesBySubscriptionId[subscriptionId] = name
        bridgeCallSyncWhenInitialized(
            method: "observeFlag",
            args: "'\(NativePolyfills.escapeForJS(subscriptionId))', '\(NativePolyfills.escapeForJS(name))'"
        )

        return subject.eraseToAnyPublisher()
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

    /// Return whether Core would currently allow the named event method.
    func hasConsent(method: String) -> Bool {
        guard isInitialized else { return false }
        let escaped = NativePolyfills.escapeForJS(method)

        guard let result = bridgeCallSyncWhenInitialized(method: "hasConsent", args: "'\(escaped)'"),
              !result.isNull && !result.isUndefined
        else { return false }

        return result.toBool()
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

    /// Override an audience's qualification state and set variant overrides for associated experiences.
    public func overrideAudience(id: String, qualified: Bool, experienceIds: [String]) {
        let escapedId = NativePolyfills.escapeForJS(id)
        let escapedIds = experienceIds.map { "'\(NativePolyfills.escapeForJS($0))'" }.joined(separator: ",")
        bridgeCallSyncWhenInitialized(method: "overrideAudience", args: "'\(escapedId)', \(qualified), [\(escapedIds)]")
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

    /// Hand Contentful audience and experience entries to the JS core SDK so it
    /// can run the shared entry mappers and serve a pre-baked preview model via
    /// ``getPreviewState()``. Call this once on panel open after fetching entries
    /// from Contentful via ``PreviewContentfulClient``.
    public func loadDefinitions(
        audiences: [[String: Any]],
        experiences: [[String: Any]]
    ) throws {
        let audienceData = try JSONSerialization.data(withJSONObject: audiences, options: [])
        let experienceData = try JSONSerialization.data(withJSONObject: experiences, options: [])
        guard
            let audienceJSON = String(data: audienceData, encoding: .utf8),
            let experienceJSON = String(data: experienceData, encoding: .utf8)
        else {
            throw OptimizationError.configError("loadDefinitions: failed to encode entries as UTF-8 JSON")
        }
        bridgeCallSyncWhenInitialized(
            method: "loadDefinitions",
            args: "\(audienceJSON), \(experienceJSON)"
        )
    }

    /// Pull the current preview state from the JS bridge and republish it via
    /// ``previewState``. Use this when a view needs to guarantee the publisher
    /// reflects the latest bridge-side snapshot — typically on preview-panel
    /// open, before any API refresh or override mutation has fired a push.
    public func refreshPreviewState() {
        previewState = getPreviewState()
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
            log.debug("[preview] getPreviewState: profile=\(hasProfile ? "present" : "nil"), canOptimize=\(state.canOptimize)")
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

        for subscriptionId in flagSubscriptionIdsByName.values {
            bridge.callSync(method: "unobserveFlag", args: "'\(NativePolyfills.escapeForJS(subscriptionId))'")
        }
        clearFlagObservers()
        bridge.destroy()
        isInitialized = false
        state = .empty
        locale = nil
        selectedOptimizations = nil
        optimizationPossible = false
        experienceRequestState = ["status": "idle"]
    }

    // MARK: - Testing

    /// Test-only hook to observe bridge log messages (including JS exceptions).
    /// Not part of the public API contract.
    func testOnlySetLogHandler(_ handler: @escaping (String, String) -> Void) {
        bridge.onLog = { [weak self] level, msg in
            self?.log.debug("[js:\(level)] \(msg)")
            handler(level, msg)
        }
    }

    /// Test-only: evaluate a JS script in the bridge context. Returns the string result.
    /// Not part of the public API contract.
    @discardableResult
    func testOnlyEvaluateScript(_ script: String) -> String? {
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
        let changes = Self.extractJSONArray(dict["changes"])
        let consent = dict["consent"] as? Bool
        let persistenceConsent = dict["persistenceConsent"] as? Bool
        let locale = dict["locale"] as? String
        let selectedOptimizations = Self.extractJSONArray(dict["selectedOptimizations"])
        let optimizationPossible = dict["optimizationPossible"] as? Bool ?? false
        let experienceRequestState =
            Self.extractJSONValue(dict["experienceRequestState"]) ?? ["status": "idle"]

        if let profile = profile {
            log.info("[state] Profile updated with \(profile.keys.sorted().joined(separator: ", "))")
        } else {
            log.debug("[state] State update received (profile=nil, consent=\(consent.map(String.init) ?? "nil"), canOptimize=\(dict["canOptimize"] as? Bool ?? false))")
        }

        self.locale = locale

        if let changes = changes {
            log.debug("[state] Changes: \(changes.count) entries")
        }
        if let selectedOptimizations {
            log.debug("[state] Selected optimizations: \(selectedOptimizations.count) entries")
        }

        // Persist state to storage
        store.consent = consent
        store.persistenceConsent = persistenceConsent
        if persistenceConsent == true {
            store.profile = profile
            store.changes = changes
            store.selectedOptimizations = selectedOptimizations
            store.anonymousId = (profile?["id"] as? String) ?? store.anonymousId
        } else if persistenceConsent == false {
            store.clearProfileContinuity()
        }

        self.selectedOptimizations = selectedOptimizations
        self.optimizationPossible = optimizationPossible
        self.experienceRequestState = experienceRequestState
        state = OptimizationState(
            profile: profile,
            consent: consent,
            persistenceConsent: persistenceConsent,
            canOptimize: dict["canOptimize"] as? Bool ?? false,
            optimizationPossible: optimizationPossible,
            experienceRequestState: experienceRequestState,
            changes: changes,
            selectedOptimizations: selectedOptimizations,
            locale: locale
        )
    }

    private func clearFlagObservers() {
        flagSubjects.removeAll()
        flagSubscriptionIdsByName.removeAll()
        flagNamesBySubscriptionId.removeAll()
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

    private static func parseJSONValue(_ json: String) -> JSONValue? {
        guard json != "undefined",
              let data = json.data(using: .utf8)
        else { return nil }
        do {
            return try JSONDecoder().decode(JSONValue.self, from: data)
        } catch {
            DiagnosticLogger.shared.warning("[parse] JSON value parse failed: \(error.localizedDescription) — input: \(json.prefix(200))")
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
