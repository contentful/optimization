import Foundation

/// Payload for tracking a click event.
public struct TrackClickPayload {
    public let componentId: String
    public let experienceId: String?
    public let variantIndex: Int

    public init(
        componentId: String,
        experienceId: String? = nil,
        variantIndex: Int
    ) {
        self.componentId = componentId
        self.experienceId = experienceId
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
        let data = try JSONSerialization.data(withJSONObject: dict)
        guard let str = String(data: data, encoding: .utf8) else {
            throw OptimizationError.configError("Failed to serialize TrackClickPayload")
        }
        return str
    }
}
