import Foundation

/// Contentful locale configuration used to resolve the CDA locale.
public struct ContentfulLocales {
    public let defaultLocale: String
    public let supported: [String]

    public init(default defaultLocale: String, supported: [String] = []) {
        self.defaultLocale = defaultLocale
        self.supported = supported
    }

    fileprivate func resolve(candidates: [String]) throws -> String {
        let supportedLocales = try (supported + [defaultLocale]).enumerated().map { index, value -> SupportedLocale in
            let normalized = try normalizeExplicitLocale(
                value,
                name: index < supported.count ? "contentfulLocales.supported[\(index)]" : "contentfulLocales.default"
            )
            // Contentful locale codes are API identifiers, so matching uses a private key while
            // resolved values preserve the configured code.
            return SupportedLocale(value: value, matchKey: getLocaleMatchKey(normalized))
        }
        let candidateMatchKeys = candidates.compactMap(normalizeLocale).map(getLocaleMatchKey)

        for candidateMatchKey in candidateMatchKeys {
            if let exactMatch = supportedLocales.first(where: { $0.matchKey == candidateMatchKey }) {
                return exactMatch.value
            }
        }

        for candidateMatchKey in candidateMatchKeys {
            for fallbackMatchKey in getFallbackMatchKeys(candidateMatchKey) {
                if let fallbackMatch = supportedLocales.first(
                    where: { $0.matchKey == fallbackMatchKey || $0.matchKey.hasPrefix("\(fallbackMatchKey)-") }
                ) {
                    return fallbackMatch.value
                }
            }
        }

        return defaultLocale
    }
}

private struct SupportedLocale {
    let value: String
    let matchKey: String
}

private func normalizeLocale(_ locale: String?) -> String? {
    guard let locale else { return nil }

    let normalizedLocale = locale.trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "_", with: "-")
    let matchKey = getLocaleMatchKey(normalizedLocale)

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

private func getLocaleMatchKey(_ locale: String) -> String {
    locale.lowercased()
}

private func getFallbackMatchKeys(_ matchKey: String) -> [String] {
    let subtags = matchKey.split(separator: "-").map(String.init)
    guard subtags.count > 1 else { return [] }

    return stride(from: subtags.count - 1, through: 1, by: -1).map { size in
        subtags.prefix(size).joined(separator: "-")
    }
}

/// Defaults that can be restored from persistent storage.
public struct StorageDefaults {
    public var consent: Bool?
    public var profile: [String: Any]?
    public var changes: [[String: Any]]?
    public var personalizations: [[String: Any]]?

    public init(
        consent: Bool? = nil,
        profile: [String: Any]? = nil,
        changes: [[String: Any]]? = nil,
        personalizations: [[String: Any]]? = nil
    ) {
        self.consent = consent
        self.profile = profile
        self.changes = changes
        self.personalizations = personalizations
    }
}

/// Nested API configuration for SDK requests.
public struct OptimizationApiConfig {
    /// Experience API locale used for localized profile fields.
    public let locale: String?

    public init(locale: String? = nil) {
        self.locale = locale
    }
}

/// Configuration for initializing the Contentful Optimization SDK.
public struct OptimizationConfig {
    public let clientId: String
    public let environment: String
    public let experienceBaseUrl: String?
    public let insightsBaseUrl: String?
    /// Contentful locale configuration used to resolve the CDA locale.
    public let contentfulLocales: ContentfulLocales?
    /// Initial app/content locale candidate used to resolve the Contentful locale.
    public let locale: String?
    /// Nested Experience API configuration.
    public let api: OptimizationApiConfig?
    public var defaults: StorageDefaults?

    /// When `true`, the SDK emits detailed diagnostic logs via `os.Logger`
    /// under the subsystem `com.contentful.optimization`.
    /// Logs are visible in Xcode console and Console.app.
    public var debug: Bool

    public init(
        clientId: String,
        environment: String = "master",
        experienceBaseUrl: String? = nil,
        insightsBaseUrl: String? = nil,
        contentfulLocales: ContentfulLocales? = nil,
        locale: String? = nil,
        api: OptimizationApiConfig? = nil,
        defaults: StorageDefaults? = nil,
        debug: Bool = false
    ) {
        self.clientId = clientId
        self.environment = environment
        self.experienceBaseUrl = experienceBaseUrl
        self.insightsBaseUrl = insightsBaseUrl
        self.contentfulLocales = contentfulLocales
        self.locale = locale
        self.api = api
        self.defaults = defaults
        self.debug = debug
    }

    /// Resolves the Contentful locale for CDA entry fetches.
    public func resolvedLocale(candidates: [String] = Locale.preferredLanguages) throws -> String? {
        if let locale = locale {
            if let contentfulLocales {
                return try contentfulLocales.resolve(candidates: [locale])
            }

            return try normalizeExplicitLocale(locale, name: "locale")
        }

        return try contentfulLocales?.resolve(candidates: candidates)
    }

    /// Serializes config to a JSON string for passing to the JS bridge.
    func toJSON(localeCandidates: [String] = Locale.preferredLanguages) throws -> String {
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
        if let contentfulLocales {
            dict["contentfulLocales"] = [
                "default": contentfulLocales.defaultLocale,
                "supported": contentfulLocales.supported,
            ]
        }
        if let locale = try resolvedLocale(candidates: localeCandidates) {
            dict["locale"] = locale
        }
        if let configuredApiLocale = api?.locale {
            let apiLocale = try normalizeExplicitLocale(configuredApiLocale, name: "api.locale")
            dict["api"] = ["locale": apiLocale]
        }

        if let defaults = defaults {
            var defaultsDict: [String: Any] = [:]
            if let consent = defaults.consent {
                defaultsDict["consent"] = consent
            }
            if let profile = defaults.profile {
                defaultsDict["profile"] = profile
            }
            if let changes = defaults.changes {
                defaultsDict["changes"] = changes
            }
            if let personalizations = defaults.personalizations {
                defaultsDict["optimizations"] = personalizations
            }
            if !defaultsDict.isEmpty {
                dict["defaults"] = defaultsDict
            }
        }

        let data = try JSONSerialization.data(withJSONObject: dict)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
