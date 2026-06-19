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
    public var personalizations: [[String: Any]]?

    public init(
        consent: Bool? = nil,
        persistenceConsent: Bool? = nil,
        profile: [String: Any]? = nil,
        changes: [[String: Any]]? = nil,
        personalizations: [[String: Any]]? = nil
    ) {
        self.consent = consent
        self.persistenceConsent = persistenceConsent
        self.profile = profile
        self.changes = changes
        self.personalizations = personalizations
    }
}

/// Configuration for initializing the Contentful Optimization SDK.
public struct OptimizationConfig {
    public let clientId: String
    public let environment: String
    public let experienceBaseUrl: String?
    public let insightsBaseUrl: String?
    /// Default SDK locale used for Experience API requests and event context.
    public let locale: String?
    public var defaults: StorageDefaults?
    public let allowedEventTypes: [String]?

    /// When `true`, the SDK emits detailed diagnostic logs via `os.Logger`
    /// under the subsystem `com.contentful.optimization`.
    /// Logs are visible in Xcode console and Console.app.
    public var debug: Bool

    public init(
        clientId: String,
        environment: String = "master",
        experienceBaseUrl: String? = nil,
        insightsBaseUrl: String? = nil,
        locale: String? = nil,
        defaults: StorageDefaults? = nil,
        debug: Bool = false,
        allowedEventTypes: [String]? = nil
    ) {
        self.clientId = clientId
        self.environment = environment
        self.experienceBaseUrl = experienceBaseUrl
        self.insightsBaseUrl = insightsBaseUrl
        self.locale = locale
        self.defaults = defaults
        self.debug = debug
        self.allowedEventTypes = allowedEventTypes
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
        ]
        if let url = experienceBaseUrl {
            dict["experienceBaseUrl"] = url
        }
        if let url = insightsBaseUrl {
            dict["insightsBaseUrl"] = url
        }
        if let locale = try normalizedLocale() {
            dict["locale"] = locale
        }
        if let allowedEventTypes {
            dict["allowedEventTypes"] = allowedEventTypes
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
            if let personalizations = defaults?.personalizations {
                defaultsDict["optimizations"] = personalizations
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
