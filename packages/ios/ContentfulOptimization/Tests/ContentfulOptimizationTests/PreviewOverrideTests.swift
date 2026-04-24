import Combine
import XCTest
@testable import ContentfulOptimization

/// Tests for the preview panel override tracking system.
///
/// The JS bridge is the single source of truth for override state.
/// These tests verify the full round-trip: seeding signal state,
/// applying overrides, reading them back via `getPreviewState()`,
/// and verifying they persist across multiple reads (simulating
/// panel close/reopen).
final class PreviewOverrideTests: XCTestCase {

    // MARK: - Helpers

    @MainActor
    private func makeInitializedClient() throws -> OptimizationClient {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )
        try client.initialize(config: config)
        return client
    }

    /// Seed the JS bridge signals with the qualifying audiences and selected
    /// optimizations the tests need. Audience qualification is carried in
    /// `profile.audiences` — the canonical location per the Experience API
    /// schema — not in the `changes` signal (which is reserved for Custom Flag
    /// `VariableChange` entries).
    @MainActor
    private func seedSignals(
        client: OptimizationClient,
        audiences: [(id: String, qualified: Bool)],
        experiences: [(id: String, variantIndex: Int)]
    ) {
        let qualifiedAudienceIds = audiences.filter(\.qualified).map(\.id)
        let audiencesJSON = qualifiedAudienceIds.map { "\"\($0)\"" }.joined(separator: ",")
        let profileScript = """
            {
                "id": "test-profile",
                "stableId": "test-profile",
                "random": 0,
                "audiences": [\(audiencesJSON)],
                "traits": {},
                "location": {},
                "session": {
                    "id": "test-session",
                    "isReturningVisitor": false,
                    "count": 1,
                    "activeSessionLength": 0,
                    "averageSessionLength": 0,
                    "landingPage": {
                        "url": "",
                        "referrer": "",
                        "query": {},
                        "search": "",
                        "path": ""
                    }
                }
            }
        """

        let experiencesJSON = experiences.map { exp in
            """
            {"experienceId":"\(exp.id)","variantIndex":\(exp.variantIndex)}
            """
        }.joined(separator: ",")

        // Reinitialize with seeded signal state via defaults
        client.testOnlyEvaluateScript("""
            __bridge.destroy();
            __bridge.initialize({
                clientId: "test-client",
                environment: "master",
                experienceBaseUrl: "http://localhost:8000/experience/",
                insightsBaseUrl: "http://localhost:8000/insights/",
                defaults: {
                    profile: \(profileScript),
                    optimizations: [\(experiencesJSON)]
                }
            });
        """)
    }

    // MARK: - getPreviewState decodes override fields

    @MainActor
    func testGetPreviewStateReturnsEmptyOverridesInitially() throws {
        let client = try makeInitializedClient()

        let state = client.getPreviewState()
        XCTAssertNotNil(state)
        XCTAssertEqual(state?.audienceOverrides ?? [:], [:])
        XCTAssertEqual(state?.variantOverrides ?? [:], [:])
        XCTAssertEqual(state?.defaultAudienceQualifications ?? [:], [:])
        XCTAssertEqual(state?.defaultVariantIndices ?? [:], [:])
    }

    // MARK: - Audience override tracking

    @MainActor
    func testOverrideAudienceTracksInBridgeState() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false), ("aud-2", true)],
            experiences: [("exp-1", 0)]
        )

        // Override aud-1 to qualified
        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])

        let state = client.getPreviewState()
        XCTAssertNotNil(state)
        XCTAssertEqual(state?.audienceOverrides?["aud-1"], true)
        XCTAssertNil(state?.audienceOverrides?["aud-2"], "aud-2 was not overridden")
        XCTAssertEqual(state?.defaultAudienceQualifications?["aud-1"], false,
                       "Default should capture the pre-override value")
    }

    @MainActor
    func testOverrideAudienceToFalseTracksCorrectly() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", true)],
            experiences: []
        )

        client.overrideAudience(id: "aud-1", qualified: false, experienceIds: [])

        let state = client.getPreviewState()
        XCTAssertEqual(state?.audienceOverrides?["aud-1"], false)
        XCTAssertEqual(state?.defaultAudienceQualifications?["aud-1"], true,
                       "Default should be the original qualified=true")
    }

    @MainActor
    func testMultipleAudienceOverrides() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false), ("aud-2", true), ("aud-3", false)],
            experiences: []
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideAudience(id: "aud-2", qualified: false, experienceIds: [])

        let state = client.getPreviewState()
        XCTAssertEqual(state?.audienceOverrides?.count, 2)
        XCTAssertEqual(state?.audienceOverrides?["aud-1"], true)
        XCTAssertEqual(state?.audienceOverrides?["aud-2"], false)
        XCTAssertNil(state?.audienceOverrides?["aud-3"], "aud-3 was not overridden")
    }

    // MARK: - Variant override tracking

    @MainActor
    func testOverrideVariantTracksInBridgeState() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [],
            experiences: [("exp-1", 0), ("exp-2", 1)]
        )

        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)

        let state = client.getPreviewState()
        XCTAssertEqual(state?.variantOverrides?["exp-1"], 2)
        XCTAssertNil(state?.variantOverrides?["exp-2"], "exp-2 was not overridden")
        XCTAssertEqual(state?.defaultVariantIndices?["exp-1"], 0,
                       "Default should capture the pre-override value")
    }

    @MainActor
    func testMultipleVariantOverrides() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [],
            experiences: [("exp-1", 0), ("exp-2", 1), ("exp-3", 2)]
        )

        client.overrideVariant(experienceId: "exp-1", variantIndex: 1)
        client.overrideVariant(experienceId: "exp-3", variantIndex: 0)

        let state = client.getPreviewState()
        XCTAssertEqual(state?.variantOverrides?.count, 2)
        XCTAssertEqual(state?.variantOverrides?["exp-1"], 1)
        XCTAssertEqual(state?.variantOverrides?["exp-3"], 0)
        XCTAssertEqual(state?.defaultVariantIndices?["exp-1"], 0)
        XCTAssertEqual(state?.defaultVariantIndices?["exp-3"], 2)
    }

    // MARK: - Override persistence across getPreviewState calls (simulates panel reopen)

    @MainActor
    func testOverridesPersistAcrossMultipleGetPreviewStateCalls() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)

        // First read (panel open)
        let state1 = client.getPreviewState()
        XCTAssertEqual(state1?.audienceOverrides?["aud-1"], true)
        XCTAssertEqual(state1?.variantOverrides?["exp-1"], 2)

        // Second read (simulates panel close and reopen)
        let state2 = client.getPreviewState()
        XCTAssertEqual(state2?.audienceOverrides?["aud-1"], true,
                       "Audience override should persist across reads")
        XCTAssertEqual(state2?.variantOverrides?["exp-1"], 2,
                       "Variant override should persist across reads")
        XCTAssertEqual(state2?.defaultAudienceQualifications?["aud-1"], false,
                       "Default audience state should persist across reads")
        XCTAssertEqual(state2?.defaultVariantIndices?["exp-1"], 0,
                       "Default variant index should persist across reads")
    }

    // MARK: - Reset single audience override

    @MainActor
    func testResetAudienceOverrideRestoresDefault() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false), ("aud-2", true)],
            experiences: []
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideAudience(id: "aud-2", qualified: false, experienceIds: [])

        // Reset only aud-1
        client.resetAudienceOverride(id: "aud-1")

        let state = client.getPreviewState()
        XCTAssertNil(state?.audienceOverrides?["aud-1"],
                     "Reset audience should be removed from overrides")
        XCTAssertEqual(state?.audienceOverrides?["aud-2"], false,
                       "Other overrides should remain")
        XCTAssertNil(state?.defaultAudienceQualifications?["aud-1"],
                     "Default snapshot for reset audience should be cleared")
        XCTAssertEqual(state?.defaultAudienceQualifications?["aud-2"], true,
                       "Default snapshot for remaining override should persist")
    }

    // MARK: - Reset single variant override

    @MainActor
    func testResetVariantOverrideRestoresDefault() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [],
            experiences: [("exp-1", 0), ("exp-2", 1)]
        )

        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)
        client.overrideVariant(experienceId: "exp-2", variantIndex: 3)

        // Reset only exp-1
        client.resetVariantOverride(experienceId: "exp-1")

        let state = client.getPreviewState()
        XCTAssertNil(state?.variantOverrides?["exp-1"],
                     "Reset variant should be removed from overrides")
        XCTAssertEqual(state?.variantOverrides?["exp-2"], 3,
                       "Other variant overrides should remain")

        // Verify the signal was restored to the default value
        let personalizations = state?.selectedPersonalizations ?? []
        let exp1 = personalizations.first(where: { $0.experienceId == "exp-1" })
        XCTAssertEqual(exp1?.variantIndex, 0,
                       "Signal should be restored to original variantIndex=0")
    }

    // MARK: - Reset all overrides

    @MainActor
    func testResetAllOverridesClearsEverything() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false), ("aud-2", true)],
            experiences: [("exp-1", 0), ("exp-2", 1)]
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideAudience(id: "aud-2", qualified: false, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)
        client.overrideVariant(experienceId: "exp-2", variantIndex: 0)

        // Verify overrides are set
        let before = client.getPreviewState()
        XCTAssertEqual(before?.audienceOverrides?.count, 2)
        XCTAssertEqual(before?.variantOverrides?.count, 2)

        // Reset all
        client.resetAllOverrides()

        let after = client.getPreviewState()
        XCTAssertEqual(after?.audienceOverrides ?? [:], [:],
                       "All audience overrides should be cleared")
        XCTAssertEqual(after?.variantOverrides ?? [:], [:],
                       "All variant overrides should be cleared")
        XCTAssertEqual(after?.defaultAudienceQualifications ?? [:], [:],
                       "Default snapshots should be cleared")
        XCTAssertEqual(after?.defaultVariantIndices ?? [:], [:],
                       "Default snapshots should be cleared")

        // Verify the variant signal was restored to defaults. (The audience
        // qualification signal — `profile.audiences` — is not rewritten by
        // overrides today; see the plan notes.)
        let personalizations = after?.selectedPersonalizations ?? []
        let exp1 = personalizations.first(where: { $0.experienceId == "exp-1" })
        let exp2 = personalizations.first(where: { $0.experienceId == "exp-2" })
        XCTAssertEqual(exp1?.variantIndex, 0, "exp-1 should be restored to original 0")
        XCTAssertEqual(exp2?.variantIndex, 1, "exp-2 should be restored to original 1")
    }

    // MARK: - Default snapshot is captured only on first override

    @MainActor
    func testDefaultSnapshotCapturedOnFirstOverrideOnly() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        // First override captures default=false
        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        let state1 = client.getPreviewState()
        XCTAssertEqual(state1?.defaultAudienceQualifications?["aud-1"], false)

        // Second override should NOT update the default
        client.overrideAudience(id: "aud-1", qualified: false, experienceIds: [])
        let state2 = client.getPreviewState()
        XCTAssertEqual(state2?.defaultAudienceQualifications?["aud-1"], false,
                       "Default should still be the original value, not the first override")
        XCTAssertEqual(state2?.audienceOverrides?["aud-1"], false,
                       "Current override should reflect the latest call")
    }

    @MainActor
    func testDefaultVariantSnapshotCapturedOnFirstOverrideOnly() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [],
            experiences: [("exp-1", 0)]
        )

        // First override captures default=0
        client.overrideVariant(experienceId: "exp-1", variantIndex: 1)
        XCTAssertEqual(client.getPreviewState()?.defaultVariantIndices?["exp-1"], 0)

        // Second override should NOT update the default
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)
        let state = client.getPreviewState()
        XCTAssertEqual(state?.defaultVariantIndices?["exp-1"], 0,
                       "Default should still be the original value")
        XCTAssertEqual(state?.variantOverrides?["exp-1"], 2,
                       "Current override should reflect the latest call")
    }

    // MARK: - Overrides survive across the full panel lifecycle

    @MainActor
    func testOverridesSurvivePanelCloseReopenCycle() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        // Simulate: panel opens, user sets overrides
        client.setPreviewPanelOpen(true)
        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 1)

        // Simulate: panel closes
        client.setPreviewPanelOpen(false)

        // Simulate: panel reopens — new PreviewViewModel would call getPreviewState()
        client.setPreviewPanelOpen(true)
        let state = client.getPreviewState()

        XCTAssertEqual(state?.audienceOverrides?["aud-1"], true,
                       "Audience override must survive panel close/reopen")
        XCTAssertEqual(state?.variantOverrides?["exp-1"], 1,
                       "Variant override must survive panel close/reopen")
        XCTAssertEqual(state?.defaultAudienceQualifications?["aud-1"], false,
                       "Default audience state must survive panel close/reopen")
        XCTAssertEqual(state?.defaultVariantIndices?["exp-1"], 0,
                       "Default variant index must survive panel close/reopen")
    }

    // MARK: - Destroy clears override tracking

    @MainActor
    func testDestroyAndReinitializeClearsOverrides() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)

        // Destroy and reinitialize
        client.destroy()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )
        try client.initialize(config: config)

        let state = client.getPreviewState()
        XCTAssertEqual(state?.audienceOverrides ?? [:], [:],
                       "Overrides should be cleared after destroy/reinitialize")
        XCTAssertEqual(state?.variantOverrides ?? [:], [:],
                       "Overrides should be cleared after destroy/reinitialize")
    }

    // MARK: - Reset clears override tracking

    @MainActor
    func testClientResetClearsOverrideTracking() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)

        // SDK reset
        client.reset()

        let state = client.getPreviewState()
        XCTAssertEqual(state?.audienceOverrides ?? [:], [:],
                       "Overrides should be cleared after SDK reset")
        XCTAssertEqual(state?.variantOverrides ?? [:], [:],
                       "Overrides should be cleared after SDK reset")
    }

    // MARK: - Override changes are reflected in the signals

    @MainActor
    func testVariantOverrideModifiesPersonalizationsSignal() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [],
            experiences: [("exp-1", 0)]
        )

        client.overrideVariant(experienceId: "exp-1", variantIndex: 3)

        let state = client.getPreviewState()
        let p = state?.selectedPersonalizations?.first(where: { $0.experienceId == "exp-1" })
        XCTAssertEqual(p?.variantIndex, 3,
                       "The selectedPersonalizations signal should reflect the override")
    }

    // MARK: - Edge cases

    @MainActor
    func testResetNonExistentAudienceOverrideIsNoOp() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: []
        )

        // Reset without having set an override first
        client.resetAudienceOverride(id: "aud-1")

        let state = client.getPreviewState()
        XCTAssertEqual(state?.audienceOverrides ?? [:], [:])
        XCTAssertEqual(state?.defaultAudienceQualifications ?? [:], [:],
                       "No-op reset should not produce a baseline snapshot")
    }

    @MainActor
    func testResetNonExistentVariantOverrideIsNoOp() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [],
            experiences: [("exp-1", 0)]
        )

        // Reset without having set an override first
        client.resetVariantOverride(experienceId: "exp-1")

        let state = client.getPreviewState()
        XCTAssertEqual(state?.variantOverrides ?? [:], [:])
        let p = state?.selectedPersonalizations?.first(where: { $0.experienceId == "exp-1" })
        XCTAssertEqual(p?.variantIndex, 0)
    }

    @MainActor
    func testOverrideThenResetThenOverrideAgain() throws {
        let client = try makeInitializedClient()
        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        // Override
        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)

        // Reset all
        client.resetAllOverrides()

        // Override again with different values
        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: [])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 3)

        let state = client.getPreviewState()
        XCTAssertEqual(state?.audienceOverrides?["aud-1"], true)
        XCTAssertEqual(state?.variantOverrides?["exp-1"], 3)
        // Defaults should be recaptured from the restored state
        XCTAssertEqual(state?.defaultAudienceQualifications?["aud-1"], false,
                       "Default should be the natural value after reset")
        XCTAssertEqual(state?.defaultVariantIndices?["exp-1"], 0,
                       "Default should be the natural value after reset")
    }

    // MARK: - onOverridesChanged push callback

    @MainActor
    func testOverrideActionPushesPreviewStateViaPublisher() async throws {
        let client = try makeInitializedClient()
        defer { client.destroy() }

        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        var emissions: [PreviewState] = []
        let emissionReceived = expectation(description: "previewState publisher emits after override")
        emissionReceived.expectedFulfillmentCount = 1
        emissionReceived.assertForOverFulfill = false

        let cancellable = client.$previewState
            .compactMap { $0 }
            .sink { state in
                emissions.append(state)
                emissionReceived.fulfill()
            }

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: ["exp-1"])

        await fulfillment(of: [emissionReceived], timeout: 2)
        cancellable.cancel()

        XCTAssertFalse(emissions.isEmpty,
                       "Publisher must emit after overrideAudience; push path, not polling")
        XCTAssertEqual(emissions.last?.audienceOverrides?["aud-1"], true,
                       "Pushed PreviewState must reflect the applied override")
    }

    @MainActor
    func testMultipleOverrideActionsEachPushPreviewState() async throws {
        let client = try makeInitializedClient()
        defer { client.destroy() }

        seedSignals(
            client: client,
            audiences: [("aud-1", false)],
            experiences: [("exp-1", 0)]
        )

        let emissionReceived = expectation(description: "publisher emits per override action")
        emissionReceived.expectedFulfillmentCount = 3
        emissionReceived.assertForOverFulfill = false

        let cancellable = client.$previewState
            .compactMap { $0 }
            .sink { _ in emissionReceived.fulfill() }

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: ["exp-1"])
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)
        client.resetAllOverrides()

        await fulfillment(of: [emissionReceived], timeout: 2)
        cancellable.cancel()
    }
}
