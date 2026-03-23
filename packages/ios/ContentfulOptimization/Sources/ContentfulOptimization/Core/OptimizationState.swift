import Foundation

/// Decoded state snapshot pushed from JS signals via `effect()`.
public struct OptimizationState: Equatable {
    public var profile: [String: Any]?
    public var consent: Bool?
    public var canPersonalize: Bool
    public var changes: [String: Any]?

    public static let empty = OptimizationState(
        profile: nil,
        consent: nil,
        canPersonalize: false,
        changes: nil
    )

    public static func == (lhs: OptimizationState, rhs: OptimizationState) -> Bool {
        let lhsProfile = lhs.profile.flatMap { try? JSONSerialization.data(withJSONObject: $0) }
        let rhsProfile = rhs.profile.flatMap { try? JSONSerialization.data(withJSONObject: $0) }
        let lhsChanges = lhs.changes.flatMap { try? JSONSerialization.data(withJSONObject: $0) }
        let rhsChanges = rhs.changes.flatMap { try? JSONSerialization.data(withJSONObject: $0) }

        return lhsProfile == rhsProfile
            && lhs.consent == rhs.consent
            && lhs.canPersonalize == rhs.canPersonalize
            && lhsChanges == rhsChanges
    }
}
