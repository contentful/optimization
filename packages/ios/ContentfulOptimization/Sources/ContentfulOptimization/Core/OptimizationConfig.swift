import Foundation

private func normalizeLocale(_ locale: String?) -> String? {
    guard let locale else { return nil }

    let normalizedLocale = locale.trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "_", with: "-")
    let matchKey = normalizedLocale.lowercased()

    guard !normalizedLocale.isEmpty,
          normalizedLocale != "*",
          matchKey != "und",
          normalizedLocale.range(
            of: #"^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$"#,
            options: .regularExpression
          ) != nil
    else { return nil }

    return normalizedLocale
}

private func normalizeExplicitLocale(_ locale: String?, name: String) throws -> String {
    guard let normalized = normalizeLocale(locale) else {
        throw OptimizationError.configError("\(name) must be a valid locale string")
    }

    return normalized
}

/// Defaults that can be restored from persistent storage.
public struct StorageDefaults {
    public var consent: Bool?
    public var persistenceConsent: Bool?
    public var profile: [String: Any]?
    public var changes: [[String: Any]]?
    public var selectedOptimizations: [[String: Any]]?

    public init(
        consent: Bool? = nil,
        persistenceConsent: Bool? = nil,
        profile: [String: Any]? = nil,
        changes: [[String: Any]]? = nil,
        selectedOptimizations: [[String: Any]]? = nil
    ) {
        self.consent = consent
        self.persistenceConsent = persistenceConsent
        self.profile = profile
        self.changes = changes
        self.selectedOptimizations = selectedOptimizations
    }
}

/// API options forwarded to the shared Optimization bridge.
public struct OptimizationApiConfig {
    public let experienceBaseUrl: String?
    public let insightsBaseUrl: String?
    public let enabledFeatures: [String]?
    public let preflight: Bool?

    public init(
        experienceBaseUrl: String? = nil,
        insightsBaseUrl: String? = nil,
        enabledFeatures: [String]? = nil,
        preflight: Bool? = nil
    ) {
        self.experienceBaseUrl = experienceBaseUrl
        self.insightsBaseUrl = insightsBaseUrl
        self.enabledFeatures = enabledFeatures
        self.preflight = preflight
    }

    var isEmpty: Bool {
        experienceBaseUrl == nil
            && insightsBaseUrl == nil
            && enabledFeatures == nil
            && preflight == nil
    }

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [:]
        if let experienceBaseUrl {
            dict["experienceBaseUrl"] = experienceBaseUrl
        }
        if let insightsBaseUrl {
            dict["insightsBaseUrl"] = insightsBaseUrl
        }
        if let enabledFeatures {
            dict["enabledFeatures"] = enabledFeatures
        }
        if let preflight {
            dict["preflight"] = preflight
        }
        return dict
    }
}

/// Minimum native and bridge log level.
public enum OptimizationLogLevel: String {
    case fatal
    case error
    case warn
    case info
    case debug
    case log
}

/// Queue flush retry policy forwarded to Core.
public struct QueueFlushPolicy {
    public let flushIntervalMs: Int?
    public let baseBackoffMs: Int?
    public let maxBackoffMs: Int?
    public let jitterRatio: Double?
    public let maxConsecutiveFailures: Int?
    public let circuitOpenMs: Int?

    public init(
        flushIntervalMs: Int? = nil,
        baseBackoffMs: Int? = nil,
        maxBackoffMs: Int? = nil,
        jitterRatio: Double? = nil,
        maxConsecutiveFailures: Int? = nil,
        circuitOpenMs: Int? = nil
    ) {
        self.flushIntervalMs = flushIntervalMs
        self.baseBackoffMs = baseBackoffMs
        self.maxBackoffMs = maxBackoffMs
        self.jitterRatio = jitterRatio
        self.maxConsecutiveFailures = maxConsecutiveFailures
        self.circuitOpenMs = circuitOpenMs
    }

    var isEmpty: Bool {
        flushIntervalMs == nil
            && baseBackoffMs == nil
            && maxBackoffMs == nil
            && jitterRatio == nil
            && maxConsecutiveFailures == nil
            && circuitOpenMs == nil
    }

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [:]
        if let flushIntervalMs {
            dict["flushIntervalMs"] = flushIntervalMs
        }
        if let baseBackoffMs {
            dict["baseBackoffMs"] = baseBackoffMs
        }
        if let maxBackoffMs {
            dict["maxBackoffMs"] = maxBackoffMs
        }
        if let jitterRatio {
            dict["jitterRatio"] = jitterRatio
        }
        if let maxConsecutiveFailures {
            dict["maxConsecutiveFailures"] = maxConsecutiveFailures
        }
        if let circuitOpenMs {
            dict["circuitOpenMs"] = circuitOpenMs
        }
        return dict
    }
}

/// Queue policy and native queue observability callbacks.
public struct QueuePolicy {
    public let flush: QueueFlushPolicy?
    public let offlineMaxEvents: Int?
    public let onOfflineDrop: ((QueueEvent) -> Void)?
    public let onFlushFailure: ((QueueEvent) -> Void)?
    public let onCircuitOpen: ((QueueEvent) -> Void)?
    public let onFlushRecovered: ((QueueEvent) -> Void)?

    public init(
        flush: QueueFlushPolicy? = nil,
        offlineMaxEvents: Int? = nil,
        onOfflineDrop: ((QueueEvent) -> Void)? = nil,
        onFlushFailure: ((QueueEvent) -> Void)? = nil,
        onCircuitOpen: ((QueueEvent) -> Void)? = nil,
        onFlushRecovered: ((QueueEvent) -> Void)? = nil
    ) {
        self.flush = flush
        self.offlineMaxEvents = offlineMaxEvents
        self.onOfflineDrop = onOfflineDrop
        self.onFlushFailure = onFlushFailure
        self.onCircuitOpen = onCircuitOpen
        self.onFlushRecovered = onFlushRecovered
    }

    var isEmpty: Bool {
        (flush == nil || flush?.isEmpty == true) && offlineMaxEvents == nil
    }

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [:]
        if let flush, !flush.isEmpty {
            dict["flush"] = flush.toDictionary()
        }
        if let offlineMaxEvents {
            dict["offlineMaxEvents"] = offlineMaxEvents
        }
        return dict
    }
}

/// Event blocked by consent or SDK guard logic.
public struct BlockedEvent {
    public let reason: String
    public let method: String
    public let args: [Any]
}

/// Queue callback event type.
public enum QueueEventType: String {
    case offlineDrop
    case flushFailure
    case circuitOpen
    case flushRecovered
}

/// Queue event emitted by the shared bridge.
public struct QueueEvent {
    public let type: QueueEventType
    public let context: [String: Any]
}

/// Configuration for initializing the Contentful Optimization SDK.
public struct OptimizationConfig {
    public let clientId: String
    public let environment: String
    public let api: OptimizationApiConfig?
    /// Default SDK locale used for Experience API requests and event context.
    public let locale: String?
    public var defaults: StorageDefaults?
    public let allowedEventTypes: [String]?
    public let logLevel: OptimizationLogLevel
    public let queuePolicy: QueuePolicy?
    public let onEventBlocked: ((BlockedEvent) -> Void)?

    public init(
        clientId: String,
        environment: String = "main",
        api: OptimizationApiConfig? = nil,
        locale: String? = nil,
        defaults: StorageDefaults? = nil,
        allowedEventTypes: [String]? = nil,
        logLevel: OptimizationLogLevel = .error,
        queuePolicy: QueuePolicy? = nil,
        onEventBlocked: ((BlockedEvent) -> Void)? = nil
    ) {
        self.clientId = clientId
        self.environment = environment
        self.api = api
        self.locale = locale
        self.defaults = defaults
        self.allowedEventTypes = allowedEventTypes
        self.logLevel = logLevel
        self.queuePolicy = queuePolicy
        self.onEventBlocked = onEventBlocked
    }

    /// Normalizes the SDK locale for Experience API requests and event context.
    public func normalizedLocale() throws -> String? {
        guard let locale else { return nil }

        return try normalizeExplicitLocale(locale, name: "locale")
    }

    /// Serializes config to a JSON string for passing to the JS bridge.
    func toJSON(
        anonymousId: String? = nil
    ) throws -> String {
        var dict: [String: Any] = [
            "clientId": clientId,
            "environment": environment,
            "logLevel": logLevel.rawValue,
        ]
        if let api, !api.isEmpty {
            dict["api"] = api.toDictionary()
        }
        if let locale = try normalizedLocale() {
            dict["locale"] = locale
        }
        if let allowedEventTypes {
            dict["allowedEventTypes"] = allowedEventTypes
        }
        if let queuePolicy, !queuePolicy.isEmpty {
            dict["queuePolicy"] = queuePolicy.toDictionary()
        }
        if defaults != nil || anonymousId != nil {
            var defaultsDict: [String: Any] = [:]
            if let consent = defaults?.consent {
                defaultsDict["consent"] = consent
            }
            if let persistenceConsent = defaults?.persistenceConsent {
                defaultsDict["persistenceConsent"] = persistenceConsent
            }
            if let profile = defaults?.profile {
                defaultsDict["profile"] = profile
            }
            if let changes = defaults?.changes {
                defaultsDict["changes"] = changes
            }
            if let selectedOptimizations = defaults?.selectedOptimizations {
                defaultsDict["selectedOptimizations"] = selectedOptimizations
            }
            if let anonymousId {
                defaultsDict["anonymousId"] = anonymousId
            }
            if !defaultsDict.isEmpty {
                dict["defaults"] = defaultsDict
            }
        }

        let data = try JSONSerialization.data(withJSONObject: dict)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
