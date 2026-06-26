import Foundation

/// Payload for tracking a click event.
public struct TrackClickPayload {
    public let componentId: String
    public let experienceId: String?
    public let optimizationContextId: String?
    public let variantIndex: Int

    public init(
        componentId: String,
        experienceId: String? = nil,
        optimizationContextId: String? = nil,
        variantIndex: Int
    ) {
        self.componentId = componentId
        self.experienceId = experienceId
        self.optimizationContextId = optimizationContextId
        self.variantIndex = variantIndex
    }

    func toJSON() throws -> String {
        var dict: [String: Any] = [
            "componentId": componentId,
            "variantIndex": variantIndex,
        ]
        if let experienceId = experienceId {
            dict["experienceId"] = experienceId
        }
        if let optimizationContextId = optimizationContextId {
            dict["optimizationContextId"] = optimizationContextId
        }
        let data = try JSONSerialization.data(withJSONObject: dict)
        guard let str = String(data: data, encoding: .utf8) else {
            throw OptimizationError.configError("Failed to serialize TrackClickPayload")
        }
        return str
    }
}
