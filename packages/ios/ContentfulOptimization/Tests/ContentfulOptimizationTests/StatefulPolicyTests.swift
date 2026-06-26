import XCTest
@testable import ContentfulOptimization

final class StatefulPolicyTests: XCTestCase {

    func testConsentStoragePolicyEncodesAndDecodesStableValues() {
        XCTAssertEqual(ConsentStoragePolicy.encode(true), "accepted")
        XCTAssertEqual(ConsentStoragePolicy.encode(false), "denied")
        XCTAssertNil(ConsentStoragePolicy.encode(nil))

        XCTAssertEqual(ConsentStoragePolicy.decode("accepted"), true)
        XCTAssertEqual(ConsentStoragePolicy.decode("denied"), false)
        XCTAssertNil(ConsentStoragePolicy.decode("unknown"))
    }

    func testPersistenceConsentFallsBackToAcceptedLegacyEventConsent() {
        XCTAssertEqual(
            ConsentStoragePolicy.resolvePersistedPersistenceConsent(
                persistenceConsent: nil,
                consent: true
            ),
            true
        )
        XCTAssertNil(
            ConsentStoragePolicy.resolvePersistedPersistenceConsent(
                persistenceConsent: nil,
                consent: false
            )
        )
        XCTAssertEqual(
            ConsentStoragePolicy.resolvePersistedPersistenceConsent(
                persistenceConsent: false,
                consent: true
            ),
            false
        )
        XCTAssertEqual(
            ConsentStoragePolicy.resolvePersistedPersistenceConsent(
                persistenceConsent: true,
                consent: false
            ),
            true
        )
    }

    func testStatefulDefaultsPreferConfiguredValuesAndGatePersistedContinuity() {
        let persisted = StorageDefaults(
            consent: true,
            persistenceConsent: true,
            profile: ["id": "stored-profile"],
            changes: [["key": "stored-change"]],
            selectedOptimizations: [["experienceId": "stored-exp"]]
        )

        let denied = resolveStatefulDefaults(
            configured: StorageDefaults(consent: false),
            persisted: persisted
        )

        XCTAssertFalse(denied.canLoadPersistedContinuity)
        XCTAssertEqual(denied.defaults.consent, false)
        XCTAssertEqual(denied.defaults.persistenceConsent, false)
        XCTAssertNil(denied.defaults.profile)
        XCTAssertNil(denied.defaults.changes)
        XCTAssertNil(denied.defaults.selectedOptimizations)

        let accepted = resolveStatefulDefaults(persisted: persisted)

        XCTAssertTrue(accepted.canLoadPersistedContinuity)
        XCTAssertEqual(accepted.defaults.consent, true)
        XCTAssertEqual(accepted.defaults.persistenceConsent, true)
        XCTAssertEqual(accepted.defaults.profile?["id"] as? String, "stored-profile")
        XCTAssertEqual(accepted.defaults.changes?.first?["key"] as? String, "stored-change")
        XCTAssertEqual(
            accepted.defaults.selectedOptimizations?.first?["experienceId"] as? String,
            "stored-exp"
        )
    }
}
