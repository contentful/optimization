import Foundation

/// Defaults that can be restored from persistent storage.
public struct StorageDefaults {
    public var consent: Bool?
    public var profile: [String: Any]?
    public var changes: [String: Any]?
    public var personalizations: [[String: Any]]?

    public init(
        consent: Bool? = nil,
        profile: [String: Any]? = nil,
        changes: [String: Any]? = nil,
        personalizations: [[String: Any]]? = nil
    ) {
        self.consent = consent
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
        defaults: StorageDefaults? = nil,
        debug: Bool = false
    ) {
        self.clientId = clientId
        self.environment = environment
        self.experienceBaseUrl = experienceBaseUrl
        self.insightsBaseUrl = insightsBaseUrl
        self.defaults = defaults
        self.debug = debug
    }

    /// Serializes config to a JSON string for passing to the JS bridge.
    func toJSON() throws -> String {
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
                defaultsDict["personalizations"] = personalizations
            }
            if !defaultsDict.isEmpty {
                dict["defaults"] = defaultsDict
            }
        }

        let data = try JSONSerialization.data(withJSONObject: dict)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
