import Foundation

/// A type-safe representation of arbitrary JSON values.
///
/// Use this when a JSON shape is dynamic or not fully known at compile time.
/// Provides `Codable` conformance and convenience accessors for common types.
public enum JSONValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
}

// MARK: - Codable

extension JSONValue: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: JSONValue].self) {
            self = .object(object)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let v): try container.encode(v)
        case .number(let v): try container.encode(v)
        case .string(let v): try container.encode(v)
        case .array(let v): try container.encode(v)
        case .object(let v): try container.encode(v)
        }
    }
}

// MARK: - Accessors

public extension JSONValue {
    var stringValue: String? {
        guard case .string(let v) = self else { return nil }
        return v
    }

    var boolValue: Bool? {
        guard case .bool(let v) = self else { return nil }
        return v
    }

    var intValue: Int? {
        guard case .number(let v) = self else { return nil }
        return Int(v)
    }

    var doubleValue: Double? {
        guard case .number(let v) = self else { return nil }
        return v
    }

    var arrayValue: [JSONValue]? {
        guard case .array(let v) = self else { return nil }
        return v
    }

    var objectValue: [String: JSONValue]? {
        guard case .object(let v) = self else { return nil }
        return v
    }

    subscript(key: String) -> JSONValue? {
        guard case .object(let dict) = self else { return nil }
        return dict[key]
    }

    /// Converts to a Foundation type (`[String: Any]`, `[Any]`, `String`, `Bool`, `Double`, or `NSNull`).
    func toFoundation() -> Any {
        switch self {
        case .null: return NSNull()
        case .bool(let v): return v
        case .number(let v): return v
        case .string(let v): return v
        case .array(let v): return v.map { $0.toFoundation() }
        case .object(let v): return v.mapValues { $0.toFoundation() }
        }
    }

    /// Converts an array JSON value to `[String]`, extracting only string elements.
    func toStringArray() -> [String]? {
        guard case .array(let arr) = self else { return nil }
        return arr.compactMap(\.stringValue)
    }
}
