import Combine
import JavaScriptCore
import XCTest
@testable import ContentfulOptimization

final class OptimizationClientTests: XCTestCase {

    // MARK: - Config Tests

    func testConfigToJSON() throws {
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        let json = try config.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: String]

        XCTAssertEqual(dict["clientId"], "test-client")
        XCTAssertEqual(dict["environment"], "master")
        XCTAssertEqual(dict["experienceBaseUrl"], "http://localhost:8000/experience/")
        XCTAssertEqual(dict["insightsBaseUrl"], "http://localhost:8000/insights/")
    }

    func testConfigDefaultEnvironment() {
        let config = OptimizationConfig(clientId: "test")
        XCTAssertEqual(config.environment, "master")
        XCTAssertNil(config.experienceBaseUrl)
        XCTAssertNil(config.insightsBaseUrl)
    }

    func testConfigToJSONOmitsNilUrls() throws {
        let config = OptimizationConfig(clientId: "test")
        let json = try config.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: String]

        XCTAssertEqual(dict.count, 2)
        XCTAssertEqual(dict["clientId"], "test")
        XCTAssertEqual(dict["environment"], "master")
    }

    // MARK: - State Tests

    func testOptimizationStateEmpty() {
        let state = OptimizationState.empty
        XCTAssertNil(state.profile)
        XCTAssertNil(state.consent)
        XCTAssertFalse(state.canPersonalize)
        XCTAssertNil(state.changes)
    }

    func testOptimizationStateEquality() {
        let a = OptimizationState(
            profile: ["userId": "test"] as [String: Any],
            consent: true,
            canPersonalize: true,
            changes: nil
        )
        let b = OptimizationState(
            profile: ["userId": "test"] as [String: Any],
            consent: true,
            canPersonalize: true,
            changes: nil
        )
        XCTAssertEqual(a, b)
    }

    func testOptimizationStateInequality() {
        let a = OptimizationState(
            profile: nil,
            consent: true,
            canPersonalize: true,
            changes: nil
        )
        let b = OptimizationState(
            profile: nil,
            consent: false,
            canPersonalize: true,
            changes: nil
        )
        XCTAssertNotEqual(a, b)
    }

    // MARK: - Error Tests

    func testErrorDescriptions() {
        let notInit = OptimizationError.notInitialized
        XCTAssertEqual(
            notInit.errorDescription,
            "SDK not initialized. Call initialize() first."
        )

        let bridgeErr = OptimizationError.bridgeError("test error")
        XCTAssertEqual(bridgeErr.errorDescription, "JS Bridge error: test error")

        let resourceErr = OptimizationError.resourceLoadError("missing file")
        XCTAssertEqual(resourceErr.errorDescription, "Resource load error: missing file")

        let configErr = OptimizationError.configError("bad config")
        XCTAssertEqual(configErr.errorDescription, "Config error: bad config")
    }

    // MARK: - Polyfill Script Loader Tests

    func testPolyfillScriptsLoad() throws {
        let scripts = try PolyfillScriptLoader.loadAll()
        XCTAssertEqual(scripts.count, 8, "Expected 8 polyfill scripts")

        // Verify they contain expected content
        XCTAssertTrue(scripts[0].contains("__nativeLog"), "console.js should reference __nativeLog")
        XCTAssertTrue(scripts[1].contains("__nativeSetTimeout"), "timers.js should reference __nativeSetTimeout")
        XCTAssertTrue(scripts[2].contains("__nativeFetch"), "fetch.js should reference __nativeFetch")
        XCTAssertTrue(scripts[3].contains("__nativeRandomUUID"), "crypto.js should reference __nativeRandomUUID")
    }

    // MARK: - Bridge Callback Manager Tests

    func testCallbackManagerGeneratesUniqueIds() {
        let manager = BridgeCallbackManager()
        let ctx = JSContext()!

        var successNames: [String] = []

        for _ in 0..<5 {
            let names = manager.registerCallback(
                in: ctx,
                prefix: "test",
                onSuccess: { _ in },
                onError: { _ in }
            )
            successNames.append(names.success)
        }

        // All names should be unique
        let uniqueNames = Set(successNames)
        XCTAssertEqual(uniqueNames.count, 5, "All callback names should be unique")
    }

    func testCallbackManagerAutoCleans() {
        let ctx = JSContext()!
        let manager = BridgeCallbackManager()

        let names = manager.registerCallback(
            in: ctx,
            prefix: "clean",
            onSuccess: { _ in },
            onError: { _ in }
        )

        // Verify callbacks are registered
        let beforeSuccess = ctx.evaluateScript("typeof \(names.success)")
        XCTAssertEqual(beforeSuccess?.toString(), "function")

        // Invoke the success callback to trigger auto-clean
        ctx.evaluateScript("\(names.success)('ok')")

        // After invocation, callbacks should be cleaned up
        let afterSuccess = ctx.evaluateScript("typeof \(names.success)")
        XCTAssertEqual(afterSuccess?.toString(), "undefined")

        let afterError = ctx.evaluateScript("typeof \(names.error)")
        XCTAssertEqual(afterError?.toString(), "undefined")
    }

    // MARK: - JSContext Manager Tests

    @MainActor
    func testJSContextManagerInitializes() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        var logMessages: [(String, String)] = []
        manager.onLog = { level, msg in
            logMessages.append((level, msg))
        }

        try manager.initialize(config: config)

        XCTAssertNotNil(manager.context, "Context should be set after initialization")

        // Verify bridge is accessible
        let bridgeType = manager.context?.evaluateScript("typeof __bridge")
        XCTAssertEqual(bridgeType?.toString(), "object")
    }

    @MainActor
    func testJSContextManagerDestroy() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try manager.initialize(config: config)
        XCTAssertNotNil(manager.context)

        manager.destroy()
        XCTAssertNil(manager.context)
    }

    @MainActor
    func testJSContextManagerGetProfile() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try manager.initialize(config: config)

        let result = manager.callSync(method: "getProfile")
        // Before identify, profile should be null
        XCTAssertTrue(result?.isNull == true || result?.toString() == "null")
    }

    @MainActor
    func testJSContextManagerGetState() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try manager.initialize(config: config)

        let result = manager.callSync(method: "getState")
        XCTAssertNotNil(result)

        let stateStr = result?.toString() ?? ""
        XCTAssertFalse(stateStr.isEmpty, "getState should return a JSON string")

        // Parse and verify structure
        if let data = stateStr.data(using: .utf8),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        {
            XCTAssertTrue(dict.keys.contains("consent"))
            XCTAssertTrue(dict.keys.contains("canPersonalize"))
            XCTAssertTrue(dict.keys.contains("selectedPersonalizations"))
        } else {
            XCTFail("getState should return valid JSON")
        }
    }

    // MARK: - OptimizationClient Tests

    @MainActor
    func testClientInitialState() {
        let client = OptimizationClient()
        XCTAssertFalse(client.isInitialized)
        XCTAssertEqual(client.state, OptimizationState.empty)
        XCTAssertNil(client.selectedPersonalizations)
    }

    @MainActor
    func testClientInitialize() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)
        XCTAssertTrue(client.isInitialized)
    }

    @MainActor
    func testClientDestroy() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)
        XCTAssertTrue(client.isInitialized)

        client.destroy()
        XCTAssertFalse(client.isInitialized)
        XCTAssertEqual(client.state, OptimizationState.empty)
        XCTAssertNil(client.selectedPersonalizations)
    }

    @MainActor
    func testClientGetProfileBeforeIdentify() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)
        let profile = client.getProfile()
        XCTAssertNil(profile, "Profile should be nil before identify")
    }

    @MainActor
    func testClientIdentifyThrowsWhenNotInitialized() async {
        let client = OptimizationClient()

        do {
            _ = try await client.identify(userId: "user-1")
            XCTFail("Should have thrown notInitialized error")
        } catch let error as OptimizationError {
            if case .notInitialized = error {
                // Expected
            } else {
                XCTFail("Expected notInitialized, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    @MainActor
    func testClientPageThrowsWhenNotInitialized() async {
        let client = OptimizationClient()

        do {
            _ = try await client.page()
            XCTFail("Should have thrown notInitialized error")
        } catch let error as OptimizationError {
            if case .notInitialized = error {
                // Expected
            } else {
                XCTFail("Expected notInitialized, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Phase 2: Sync Method Tests

    @MainActor
    func testClientConsentCallsThrough() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)

        // Should not throw
        client.consent(true)
        client.consent(false)
    }

    @MainActor
    func testClientResetCallsThrough() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)

        // Should not throw
        client.reset()
    }

    @MainActor
    func testClientSetOnlineCallsThrough() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)

        // Should not throw
        client.setOnline(true)
        client.setOnline(false)
    }

    @MainActor
    func testClientSyncMethodsNoOpWhenNotInitialized() {
        let client = OptimizationClient()

        // These should silently no-op when not initialized
        client.consent(true)
        client.reset()
        client.setOnline(false)
    }

    // MARK: - Phase 2: personalizeEntry Tests

    @MainActor
    func testPersonalizeEntryReturnsBaselineWhenNotInitialized() {
        let client = OptimizationClient()
        let baseline: [String: Any] = ["sys": ["id": "entry1"], "fields": ["title": "Hello"]]

        let result = client.personalizeEntry(baseline: baseline)
        XCTAssertEqual(result.entry["fields"] as? [String: String], ["title": "Hello"])
        XCTAssertNil(result.personalization)
    }

    @MainActor
    func testPersonalizeEntryReturnsBaselineWhenInitialized() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)

        let baseline: [String: Any] = [
            "sys": ["id": "entry1", "contentType": ["sys": ["id": "page"]]],
            "fields": ["title": "Hello"],
        ]

        // Without personalizations set, should return baseline
        let result = client.personalizeEntry(baseline: baseline)
        XCTAssertNotNil(result.entry)
    }

    // MARK: - Phase 2: Payload Serialization Tests

    func testTrackViewPayloadToJSON() throws {
        let payload = TrackViewPayload(
            componentId: "comp-1",
            viewId: "view-1",
            experienceId: "exp-1",
            variantIndex: 2,
            viewDurationMs: 1500,
            sticky: true
        )

        let json = try payload.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(dict["componentId"] as? String, "comp-1")
        XCTAssertEqual(dict["viewId"] as? String, "view-1")
        XCTAssertEqual(dict["experienceId"] as? String, "exp-1")
        XCTAssertEqual(dict["variantIndex"] as? Int, 2)
        XCTAssertEqual(dict["viewDurationMs"] as? Int, 1500)
        XCTAssertEqual(dict["sticky"] as? Bool, true)
    }

    func testTrackViewPayloadOmitsOptionalFields() throws {
        let payload = TrackViewPayload(
            componentId: "comp-1",
            viewId: "view-1",
            variantIndex: 0,
            viewDurationMs: 500
        )

        let json = try payload.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(dict.count, 4)
        XCTAssertNil(dict["experienceId"])
        XCTAssertNil(dict["sticky"])
    }

    func testTrackClickPayloadToJSON() throws {
        let payload = TrackClickPayload(
            componentId: "comp-1",
            experienceId: "exp-1",
            variantIndex: 1
        )

        let json = try payload.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(dict["componentId"] as? String, "comp-1")
        XCTAssertEqual(dict["experienceId"] as? String, "exp-1")
        XCTAssertEqual(dict["variantIndex"] as? Int, 1)
    }

    func testTrackClickPayloadOmitsOptionalFields() throws {
        let payload = TrackClickPayload(
            componentId: "comp-1",
            variantIndex: 0
        )

        let json = try payload.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(dict.count, 2)
        XCTAssertNil(dict["experienceId"])
    }

    // MARK: - Phase 2: Async Method Not-Initialized Tests

    @MainActor
    func testClientScreenThrowsWhenNotInitialized() async {
        let client = OptimizationClient()

        do {
            _ = try await client.screen(name: "Home")
            XCTFail("Should have thrown notInitialized error")
        } catch let error as OptimizationError {
            if case .notInitialized = error {
                // Expected
            } else {
                XCTFail("Expected notInitialized, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    @MainActor
    func testClientFlushThrowsWhenNotInitialized() async {
        let client = OptimizationClient()

        do {
            try await client.flush()
            XCTFail("Should have thrown notInitialized error")
        } catch let error as OptimizationError {
            if case .notInitialized = error {
                // Expected
            } else {
                XCTFail("Expected notInitialized, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    @MainActor
    func testClientTrackViewThrowsWhenNotInitialized() async {
        let client = OptimizationClient()
        let payload = TrackViewPayload(
            componentId: "c1", viewId: "v1", variantIndex: 0, viewDurationMs: 100
        )

        do {
            _ = try await client.trackView(payload)
            XCTFail("Should have thrown notInitialized error")
        } catch let error as OptimizationError {
            if case .notInitialized = error {
                // Expected
            } else {
                XCTFail("Expected notInitialized, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    @MainActor
    func testClientTrackClickThrowsWhenNotInitialized() async {
        let client = OptimizationClient()
        let payload = TrackClickPayload(componentId: "c1", variantIndex: 0)

        do {
            _ = try await client.trackClick(payload)
            XCTFail("Should have thrown notInitialized error")
        } catch let error as OptimizationError {
            if case .notInitialized = error {
                // Expected
            } else {
                XCTFail("Expected notInitialized, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Phase 2: Event Publisher Tests

    @MainActor
    func testEventPublisherReceivesEvents() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        var receivedEvents: [[String: Any]] = []
        manager.onEvent = { dict in
            receivedEvents.append(dict)
        }

        try manager.initialize(config: config)

        // Simulate an event being pushed from JS
        manager.context?.evaluateScript("""
            if (typeof __nativeOnEventEmitted === 'function') {
                __nativeOnEventEmitted(JSON.stringify({ type: 'test', data: 'hello' }))
            }
        """)

        // Give the async dispatch a moment to fire
        let expectation = XCTestExpectation(description: "Event received")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            if !receivedEvents.isEmpty {
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 1.0)

        XCTAssertEqual(receivedEvents.count, 1)
        XCTAssertEqual(receivedEvents[0]["type"] as? String, "test")
        XCTAssertEqual(receivedEvents[0]["data"] as? String, "hello")
    }

    // MARK: - Phase 2: selectedPersonalizations State Tests

    @MainActor
    func testSelectedPersonalizationsUpdatedFromState() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try manager.initialize(config: config)

        // getState should include selectedPersonalizations field
        let result = manager.callSync(method: "getState")
        let stateStr = result?.toString() ?? ""
        let data = stateStr.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertTrue(dict.keys.contains("selectedPersonalizations"))
    }
}
