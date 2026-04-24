import XCTest
@testable import ContentfulOptimization

/// Tests for the pre-baked preview model served by the JS bridge. Verifies
/// the Swift `PreviewModelDTO` decoder sees what core's `buildPreviewModel`
/// produces — and that `loadDefinitions` successfully hands entries across
/// the bridge boundary.
final class PreviewModelTests: XCTestCase {

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

    private func audienceEntry(id: String, name: String) -> [String: Any] {
        [
            "sys": ["id": "sys-\(id)"],
            "fields": ["nt_audience_id": id, "nt_name": name],
        ]
    }

    private func experienceEntry(id: String, name: String, audienceId: String?) -> [String: Any] {
        var fields: [String: Any] = [
            "nt_experience_id": id,
            "nt_name": name,
        ]
        if let audienceId = audienceId {
            fields["nt_audience"] = ["sys": ["id": audienceId]]
        }
        return ["sys": ["id": "sys-\(id)"], "fields": fields]
    }

    @MainActor
    func testPreviewModelIsNullBeforeLoadDefinitions() throws {
        let client = try makeInitializedClient()
        let state = client.getPreviewState()
        XCTAssertNotNil(state)
        XCTAssertNil(state?.previewModel,
                     "previewModel must be nil until the host calls loadDefinitions()")
    }

    @MainActor
    func testLoadDefinitionsPopulatesPreviewModel() throws {
        let client = try makeInitializedClient()

        try client.loadDefinitions(
            audiences: [audienceEntry(id: "aud-1", name: "Audience One")],
            experiences: [
                experienceEntry(id: "exp-1", name: "Experience One", audienceId: "aud-1"),
            ]
        )

        let state = client.getPreviewState()
        XCTAssertNotNil(state?.previewModel, "previewModel must be populated after loadDefinitions()")
        let model = state?.previewModel

        XCTAssertEqual(model?.hasData, true)
        XCTAssertEqual(model?.audienceNameMap["aud-1"], "Audience One")
        XCTAssertEqual(model?.experienceNameMap["exp-1"], "Experience One")
        XCTAssertEqual(model?.audiencesWithExperiences.count, 1)

        let aud = model?.audiencesWithExperiences.first
        XCTAssertEqual(aud?.audience.id, "aud-1")
        XCTAssertEqual(aud?.isQualified, false)
        XCTAssertEqual(aud?.isActive, false)
        XCTAssertEqual(aud?.overrideState, "default")
        XCTAssertEqual(aud?.experiences.count, 1)
        XCTAssertEqual(aud?.experiences.first?.id, "exp-1")
    }

    @MainActor
    func testPreviewModelReflectsAudienceOverrides() throws {
        let client = try makeInitializedClient()

        try client.loadDefinitions(
            audiences: [audienceEntry(id: "aud-1", name: "Audience One")],
            experiences: [
                experienceEntry(id: "exp-1", name: "Experience One", audienceId: "aud-1"),
            ]
        )

        client.overrideAudience(id: "aud-1", qualified: true, experienceIds: ["exp-1"])

        let state = client.getPreviewState()
        let aud = state?.previewModel?.audiencesWithExperiences.first
        XCTAssertEqual(aud?.overrideState, "on")
        XCTAssertEqual(aud?.isActive, true)
    }

    /// Seed the JS bridge `selectedOptimizations` signal with a known natural
    /// baseline so the preview override manager captures it. Mirrors the
    /// pattern used by `PreviewOverrideTests.seedSignals` — just the subset
    /// this test needs.
    @MainActor
    private func seedSelectedOptimization(client: OptimizationClient, experienceId: String, variantIndex: Int) {
        client.testOnlyEvaluateScript("""
            __bridge.destroy();
            __bridge.initialize({
                clientId: "test-client",
                environment: "master",
                experienceBaseUrl: "http://localhost:8000/experience/",
                insightsBaseUrl: "http://localhost:8000/insights/",
                defaults: {
                    optimizations: [
                        {"experienceId":"\(experienceId)","variantIndex":\(variantIndex)}
                    ]
                }
            });
        """)
    }

    @MainActor
    func testExperienceDTOCarriesCurrentVariantAndOverrideFlag() throws {
        let client = try makeInitializedClient()
        seedSelectedOptimization(client: client, experienceId: "exp-1", variantIndex: 0)

        try client.loadDefinitions(
            audiences: [audienceEntry(id: "aud-1", name: "Audience One")],
            experiences: [
                experienceEntry(id: "exp-1", name: "Experience One", audienceId: "aud-1"),
            ]
        )

        // Before override: defaults should surface as currentVariantIndex = 0,
        // isOverridden = false, and naturalVariantIndex not populated.
        let before = client.getPreviewState()
        let expBefore = before?.previewModel?.audiencesWithExperiences.first?.experiences.first
        XCTAssertEqual(expBefore?.currentVariantIndex, 0)
        XCTAssertEqual(expBefore?.isOverridden, false)
        XCTAssertNil(expBefore?.naturalVariantIndex)

        // Apply a variant override and re-read.
        client.overrideVariant(experienceId: "exp-1", variantIndex: 2)

        let after = client.getPreviewState()
        let expAfter = after?.previewModel?.audiencesWithExperiences.first?.experiences.first
        XCTAssertEqual(expAfter?.currentVariantIndex, 2,
                       "currentVariantIndex should reflect the applied override")
        XCTAssertEqual(expAfter?.isOverridden, true)
        XCTAssertEqual(expAfter?.naturalVariantIndex, 0,
                       "naturalVariantIndex should fall back to the baseline's 0")
    }

    @MainActor
    func testAllVisitorsBucketAppearsForUnassociatedExperiences() throws {
        let client = try makeInitializedClient()

        try client.loadDefinitions(
            audiences: [],
            experiences: [
                experienceEntry(id: "exp-global", name: "Global Experience", audienceId: nil),
            ]
        )

        let state = client.getPreviewState()
        let model = state?.previewModel
        XCTAssertEqual(model?.audiencesWithExperiences.count, 1)

        let bucket = model?.audiencesWithExperiences.first
        XCTAssertEqual(bucket?.audience.id, "ALL_VISITORS")
        XCTAssertEqual(bucket?.isQualified, true)
        XCTAssertEqual(bucket?.isActive, true)
        XCTAssertEqual(bucket?.experiences.first?.id, "exp-global")
        XCTAssertEqual(model?.unassociatedExperiences.map(\.id), ["exp-global"])
    }
}
