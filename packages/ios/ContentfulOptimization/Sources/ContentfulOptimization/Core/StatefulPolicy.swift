import Foundation

public enum ConsentStoragePolicy {
    public static let accepted = "accepted"
    public static let denied = "denied"

    public static func encode(_ consent: Bool?) -> String? {
        consent.map { $0 ? accepted : denied }
    }

    public static func decode(_ value: String?) -> Bool? {
        switch value {
        case accepted:
            return true
        case denied:
            return false
        default:
            return nil
        }
    }

    public static func resolvePersistedPersistenceConsent(
        persistenceConsent: Bool?,
        consent: Bool?
    ) -> Bool? {
        persistenceConsent ?? (consent == true ? true : nil)
    }
}

public struct ResolvedStatefulDefaults {
    public let defaults: StorageDefaults
    public let canLoadPersistedContinuity: Bool
}

public func resolveStatefulDefaults(
    configured: StorageDefaults? = nil,
    persisted: StorageDefaults = StorageDefaults()
) -> ResolvedStatefulDefaults {
    let consent = configured?.consent ?? persisted.consent
    let persistenceConsent =
        configured?.persistenceConsent ?? configured?.consent ?? persisted.persistenceConsent
    let canLoadPersistedContinuity = persistenceConsent == true

    return ResolvedStatefulDefaults(
        defaults: StorageDefaults(
            consent: consent,
            persistenceConsent: persistenceConsent,
            profile: configured?.profile ?? (canLoadPersistedContinuity ? persisted.profile : nil),
            changes: configured?.changes ?? (canLoadPersistedContinuity ? persisted.changes : nil),
            selectedOptimizations: configured?.selectedOptimizations
                ?? (canLoadPersistedContinuity ? persisted.selectedOptimizations : nil)
        ),
        canLoadPersistedContinuity: canLoadPersistedContinuity
    )
}
