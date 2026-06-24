import Foundation

/// Typed payload for identifying a user.
public struct IdentifyPayload {
    public let userId: String
    public let traits: [String: JSONValue]?

    public init(userId: String, traits: [String: JSONValue]? = nil) {
        self.userId = userId
        self.traits = traits
    }

    func toJSON() throws -> String {
        var dict: [String: Any] = ["userId": userId]
        if let traits = traits {
            dict["traits"] = traits.toFoundationObject()
        }
        return try serializePayload(dict, label: "IdentifyPayload")
    }
}

/// Typed payload for tracking a page view.
public struct PageEventPayload {
    public let properties: [String: JSONValue]

    public init(properties: [String: JSONValue] = [:]) {
        self.properties = properties
    }

    func toJSON() throws -> String {
        try serializePayload(properties.toFoundationObject(), label: "PageEventPayload")
    }
}

/// Typed payload for tracking a screen view.
public struct ScreenEventPayload {
    public let name: String
    public let properties: [String: JSONValue]
    public let routeKey: String?

    public init(
        name: String,
        properties: [String: JSONValue] = [:],
        routeKey: String? = nil
    ) {
        self.name = name
        self.properties = properties
        self.routeKey = routeKey
    }

    func toJSON() throws -> String {
        var dict: [String: Any] = ["name": name]
        if !properties.isEmpty {
            dict["properties"] = properties.toFoundationObject()
        }
        if let routeKey = routeKey {
            dict["routeKey"] = routeKey
        }
        return try serializePayload(dict, label: "ScreenEventPayload")
    }
}

/// Typed payload for tracking a custom business event.
public struct TrackEventPayload {
    public let event: String
    public let properties: [String: JSONValue]

    public init(event: String, properties: [String: JSONValue] = [:]) {
        self.event = event
        self.properties = properties
    }

    func toJSON() throws -> String {
        var dict: [String: Any] = ["event": event]
        if !properties.isEmpty {
            dict["properties"] = properties.toFoundationObject()
        }
        return try serializePayload(dict, label: "TrackEventPayload")
    }
}

private extension Dictionary where Key == String, Value == JSONValue {
    func toFoundationObject() -> [String: Any] {
        mapValues { $0.toFoundation() }
    }
}

private func serializePayload(_ value: Any, label: String) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value)
    guard let str = String(data: data, encoding: .utf8) else {
        throw OptimizationError.configError("Failed to serialize \(label)")
    }
    return str
}
