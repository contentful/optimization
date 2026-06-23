import Foundation

/// Decoded state snapshot pushed from JS signals via `effect()`.
public struct OptimizationState: Equatable {
    public var profile: [String: Any]?
    public var consent: Bool?
    public var persistenceConsent: Bool? = nil
    public var canOptimize: Bool
    public var optimizationPossible: Bool = false
    public var experienceRequestState: [String: Any] = ["status": "idle"]
    public var changes: [[String: Any]]?
    public var selectedOptimizations: [[String: Any]]? = nil
    public var locale: String? = nil

    public static let empty = OptimizationState(
        profile: nil,
        consent: nil,
        persistenceConsent: nil,
        canOptimize: false,
        optimizationPossible: false,
        experienceRequestState: ["status": "idle"],
        changes: nil,
        selectedOptimizations: nil,
        locale: nil
    )

    public static func == (lhs: OptimizationState, rhs: OptimizationState) -> Bool {
        let options: JSONSerialization.WritingOptions = [.sortedKeys]
        let lhsProfile = lhs.profile.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let rhsProfile = rhs.profile.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let lhsChanges = lhs.changes.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let rhsChanges = rhs.changes.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
        let lhsExperienceRequestState = try? JSONSerialization.data(withJSONObject: lhs.experienceRequestState, options: options)
        let rhsExperienceRequestState = try? JSONSerialization.data(withJSONObject: rhs.experienceRequestState, options: options)
        let lhsOptimizations = lhs.selectedOptimizations.flatMap {
            try? JSONSerialization.data(withJSONObject: $0, options: options)
        }
        let rhsOptimizations = rhs.selectedOptimizations.flatMap {
            try? JSONSerialization.data(withJSONObject: $0, options: options)
        }

        return lhsProfile == rhsProfile
            && lhs.consent == rhs.consent
            && lhs.persistenceConsent == rhs.persistenceConsent
            && lhs.canOptimize == rhs.canOptimize
            && lhs.optimizationPossible == rhs.optimizationPossible
            && lhsExperienceRequestState == rhsExperienceRequestState
            && lhsChanges == rhsChanges
            && lhsOptimizations == rhsOptimizations
            && lhs.locale == rhs.locale
    }
}
