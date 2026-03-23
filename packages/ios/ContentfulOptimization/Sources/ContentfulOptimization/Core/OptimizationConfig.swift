import Foundation

/// Configuration for initializing the Contentful Optimization SDK.
public struct OptimizationConfig {
    public let clientId: String
    public let environment: String
    public let experienceBaseUrl: String?
    public let insightsBaseUrl: String?

    public init(
        clientId: String,
        environment: String = "master",
        experienceBaseUrl: String? = nil,
        insightsBaseUrl: String? = nil
    ) {
        self.clientId = clientId
        self.environment = environment
        self.experienceBaseUrl = experienceBaseUrl
        self.insightsBaseUrl = insightsBaseUrl
    }

    /// Serializes config to a JSON string for passing to the JS bridge.
    func toJSON() throws -> String {
        var dict: [String: String] = [
            "clientId": clientId,
            "environment": environment,
        ]
        if let url = experienceBaseUrl {
            dict["experienceBaseUrl"] = url
        }
        if let url = insightsBaseUrl {
            dict["insightsBaseUrl"] = url
        }
        let data = try JSONSerialization.data(withJSONObject: dict)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
