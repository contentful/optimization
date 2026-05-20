import Foundation

/// Decoded state snapshot pushed from JS signals via `effect()`.
public struct OptimizationState: Equatable {
    public var profile: [String: Any]?
    public var consent: Bool?
    public var canPersonalize: Bool
    public var changes: [[String: Any]]?

    public static let empty = OptimizationState(
        profile: nil,
        consent: nil,
        canPersonalize: false,
        changes: nil
    )

    /// Hand-written `Equatable` conformance: `[String: Any]` is not `Equatable`, so `profile`
    /// and `changes` are compared by canonical (`sortedKeys`) JSON serialization. This backs
    /// SwiftUI/Combine `removeDuplicates`; it is not a duplicate of core's "what changed"
    /// signal-write gate, which runs inside the JS core and never crosses the bridge.
    public static func == (lhs: OptimizationState, rhs: OptimizationState) -> Bool {
        let options: JSONSerialization.WritingOptions = [.sortedKeys]
        let lhsProfile = lhs.profile.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let rhsProfile = rhs.profile.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let lhsChanges = lhs.changes.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let rhsChanges = rhs.changes.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }

        return lhsProfile == rhsProfile
            && lhs.consent == rhs.consent
            && lhs.canPersonalize == rhs.canPersonalize
            && lhsChanges == rhsChanges
    }
}
