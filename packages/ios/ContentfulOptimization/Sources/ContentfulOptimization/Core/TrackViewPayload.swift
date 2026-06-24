import Foundation

/// Payload for tracking a view event.
public struct TrackViewPayload {
    public let componentId: String
    public let viewId: String
    public let experienceId: String?
    public let variantIndex: Int
    public let viewDurationMs: Int
    public let sticky: Bool?
    public let stickyTrackingKey: String?

    public init(
        componentId: String,
        viewId: String,
        experienceId: String? = nil,
        variantIndex: Int,
        viewDurationMs: Int,
        sticky: Bool? = nil,
        stickyTrackingKey: String? = nil
    ) {
        self.componentId = componentId
        self.viewId = viewId
        self.experienceId = experienceId
        self.variantIndex = variantIndex
        self.viewDurationMs = viewDurationMs
        self.sticky = sticky
        self.stickyTrackingKey = stickyTrackingKey
    }

    func toJSON() throws -> String {
        var dict: [String: Any] = [
            "componentId": componentId,
            "viewId": viewId,
            "variantIndex": variantIndex,
            "viewDurationMs": viewDurationMs,
        ]
        if let experienceId = experienceId {
            dict["experienceId"] = experienceId
        }
        if let sticky = sticky {
            dict["sticky"] = sticky
        }
        if let stickyTrackingKey = stickyTrackingKey {
            dict["stickyTrackingKey"] = stickyTrackingKey
        }
        let data = try JSONSerialization.data(withJSONObject: dict)
        guard let str = String(data: data, encoding: .utf8) else {
            throw OptimizationError.configError("Failed to serialize TrackViewPayload")
        }
        return str
    }
}
