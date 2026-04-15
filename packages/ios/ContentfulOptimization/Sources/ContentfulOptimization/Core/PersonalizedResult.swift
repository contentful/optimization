import Foundation

/// The result of personalizing an entry.
public struct PersonalizedResult {
    public let entry: [String: Any]
    public let personalization: [String: Any]?
}
