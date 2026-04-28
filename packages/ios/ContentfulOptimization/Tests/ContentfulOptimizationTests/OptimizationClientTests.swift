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

    func testConfigSerializesDefaultsAsOptimizationsKey() throws {
        let seeded: [[String: Any]] = [
            ["experienceId": "exp-1", "variantIndex": 2]
        ]
        let config = OptimizationConfig(
            clientId: "test",
            defaults: StorageDefaults(personalizations: seeded)
        )

        let json = try config.toJSON()
        let data = json.data(using: .utf8)!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let defaults = dict["defaults"] as? [String: Any]

        XCTAssertNotNil(defaults?["optimizations"],
                        "Bridge reads defaults.optimizations; Swift must serialize under that key")
        XCTAssertNil(defaults?["personalizations"],
                     "Old key name must not be emitted")

        let optimizations = defaults?["optimizations"] as? [[String: Any]]
        XCTAssertEqual(optimizations?.count, 1)
        XCTAssertEqual(optimizations?.first?["experienceId"] as? String, "exp-1")
        XCTAssertEqual(optimizations?.first?["variantIndex"] as? Int, 2)
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

    func testOptimizationStateEqualityMultiKeyDictionaries() {
        let a = OptimizationState(
            profile: ["userId": "u1", "email": "a@b.com", "plan": "pro"] as [String: Any],
            consent: true,
            canPersonalize: true,
            changes: [["key": "hero", "value": "A"] as [String: Any]]
        )
        let b = OptimizationState(
            profile: ["plan": "pro", "email": "a@b.com", "userId": "u1"] as [String: Any],
            consent: true,
            canPersonalize: true,
            changes: [["key": "hero", "value": "A"] as [String: Any]]
        )
        XCTAssertEqual(a, b, "States with identical profile contents in different key order must be equal")
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

    @MainActor
    func testPersonalizeEntryDoesNotProduceJSExceptions() throws {
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        try client.initialize(config: config)

        // Capture any JS exceptions
        var jsExceptions: [String] = []
        client.testOnlySetLogHandler { level, msg in
            if level == "exception" {
                jsExceptions.append(msg)
            }
        }

        let baseline: [String: Any] = [
            "sys": ["id": "entry1", "contentType": ["sys": ["id": "page"]]],
            "fields": ["title": "Hello"],
        ]

        let result = client.personalizeEntry(baseline: baseline)
        XCTAssertNotNil(result.entry)
        XCTAssertTrue(
            jsExceptions.isEmpty,
            "personalizeEntry should not produce JS exceptions, got: \(jsExceptions)"
        )
    }

    @MainActor
    func testPersonalizeEntryPreservesFieldsWhenInitialized() throws {
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
            "fields": ["title": "Hello", "slug": "hello-world"],
        ]

        // personalizeEntry should round-trip the entry through JS and back
        // without losing fields (i.e. the JS bridge should actually process it)
        let result = client.personalizeEntry(baseline: baseline)
        let fields = result.entry["fields"] as? [String: Any]
        XCTAssertEqual(fields?["title"] as? String, "Hello")
        XCTAssertEqual(fields?["slug"] as? String, "hello-world")
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

    // MARK: - callSync Exception Logging Tests

    @MainActor
    func testCallSyncExceptionIncludesMethodName() throws {
        let manager = JSContextManager()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        )

        var loggedExceptions: [String] = []
        manager.onLog = { level, msg in
            if level == "exception" {
                loggedExceptions.append(msg)
            }
        }

        try manager.initialize(config: config)

        // Call a method that will throw a JS error
        let result = manager.callSync(method: "personalizeEntry", args: "undefined")
        XCTAssertNil(result, "callSync should return nil on JS exception")
        XCTAssertEqual(loggedExceptions.count, 1)
        XCTAssertTrue(
            loggedExceptions[0].hasPrefix("[personalizeEntry]"),
            "Exception log should include method name, got: \(loggedExceptions[0])"
        )
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

    // MARK: - Phase 3: TrackingMetadata Tests

    func testTrackingMetadataExtraction() {
        let entry: [String: Any] = ["sys": ["id": "entry-123"]]
        let personalization: [String: Any] = [
            "experienceId": "exp-456",
            "variantIndex": 2,
            "sticky": true,
        ]
        let metadata = TrackingMetadata(entry: entry, personalization: personalization)
        XCTAssertEqual(metadata.componentId, "entry-123")
        XCTAssertEqual(metadata.experienceId, "exp-456")
        XCTAssertEqual(metadata.variantIndex, 2)
        XCTAssertEqual(metadata.sticky, true)
    }

    func testTrackingMetadataDefaults() {
        let entry: [String: Any] = ["fields": ["title": "Hello"]]
        let metadata = TrackingMetadata(entry: entry, personalization: nil)
        XCTAssertEqual(metadata.componentId, "")
        XCTAssertNil(metadata.experienceId)
        XCTAssertEqual(metadata.variantIndex, 0)
        XCTAssertNil(metadata.sticky)
    }

    // MARK: - Phase 3: TrackingConfig Tests

    func testTrackingConfigDefaults() {
        let config = TrackingConfig()
        XCTAssertTrue(config.trackViews)
        XCTAssertFalse(config.trackTaps)
        XCTAssertFalse(config.liveUpdates)
    }

    func testTrackingConfigCustomValues() {
        let config = TrackingConfig(trackViews: false, trackTaps: true, liveUpdates: true)
        XCTAssertFalse(config.trackViews)
        XCTAssertTrue(config.trackTaps)
        XCTAssertTrue(config.liveUpdates)
    }

    // MARK: - Phase 3: ScrollContext Tests

    func testScrollContextDefaults() {
        let context = ScrollContext()
        XCTAssertEqual(context.scrollY, 0)
        XCTAssertEqual(context.viewportHeight, 0)
    }

    func testScrollContextEquality() {
        let a = ScrollContext(scrollY: 100, viewportHeight: 800)
        let b = ScrollContext(scrollY: 100, viewportHeight: 800)
        XCTAssertEqual(a, b)
    }

    func testScrollContextInequality() {
        let a = ScrollContext(scrollY: 100, viewportHeight: 800)
        let b = ScrollContext(scrollY: 200, viewportHeight: 800)
        XCTAssertNotEqual(a, b)
    }

    func testScrollContextCoordinateSpaceName() {
        XCTAssertEqual(ScrollContext.coordinateSpaceName, "optimization-scroll")
    }

    // MARK: - Phase 3: ViewTrackingController Tests

    @MainActor
    func testViewTrackingControllerInitiallyInvisible() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )
        XCTAssertFalse(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerBecomesVisibleAboveThreshold() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        // Element fully visible (100% ratio >= 0.8 threshold)
        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 0, viewportHeight: 500
        )
        XCTAssertTrue(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerStaysInvisibleBelowThreshold() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        // Only 10px of 100px element visible (10% < 80% threshold)
        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 0, viewportHeight: 10
        )
        XCTAssertFalse(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerBecomesInvisibleOnDisappear() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 0, viewportHeight: 500
        )
        XCTAssertTrue(controller.isVisible)

        controller.onDisappear()
        XCTAssertFalse(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerResetsOnNewCycle() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        // First cycle: become visible then disappear
        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 0, viewportHeight: 500
        )
        XCTAssertTrue(controller.isVisible)
        controller.onDisappear()
        XCTAssertFalse(controller.isVisible)

        // Second cycle: become visible again
        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 0, viewportHeight: 500
        )
        XCTAssertTrue(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerPauseAndResume() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 0, viewportHeight: 500
        )
        XCTAssertTrue(controller.isVisible)

        controller.pause()
        XCTAssertFalse(controller.isVisible)

        // resume() resets visibility flag so it can be re-evaluated
        controller.resume()
        XCTAssertFalse(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerVisibilityWithPartialOverlap() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.5,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        // Element at Y=400, height=100, viewport 0-500
        // Visible portion: 400-500 = 100px of 100px = 100% >= 50%
        controller.updateVisibility(
            elementY: 400, elementHeight: 100, scrollY: 0, viewportHeight: 500
        )
        XCTAssertTrue(controller.isVisible)

        // Scroll so element is mostly off-screen: element at Y=400, viewport 0-430
        // Visible portion: 400-430 = 30px of 100px = 30% < 50%
        controller.updateVisibility(
            elementY: 400, elementHeight: 100, scrollY: 0, viewportHeight: 430
        )
        XCTAssertFalse(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerZeroHeightIgnored() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        // Zero-height element should not trigger visibility
        controller.updateVisibility(
            elementY: 0, elementHeight: 0, scrollY: 0, viewportHeight: 500
        )
        XCTAssertFalse(controller.isVisible)
    }

    @MainActor
    func testViewTrackingControllerScrolledPastElement() {
        let client = OptimizationClient()
        let controller = ViewTrackingController(
            client: client,
            entry: ["sys": ["id": "test"]],
            personalization: nil,
            threshold: 0.8,
            viewTimeMs: 2000,
            viewDurationUpdateIntervalMs: 5000
        )

        // Element at Y=0, height=100, but scrolled past (scrollY=200, viewport=500)
        // Visible portion: max(0, min(100, 700) - max(0, 200)) = max(0, 100-200) = 0
        controller.updateVisibility(
            elementY: 0, elementHeight: 100, scrollY: 200, viewportHeight: 500
        )
        XCTAssertFalse(controller.isVisible)
    }

    // MARK: - Phase 3: PersonalizedResult Baseline Resolution Test

    @MainActor
    func testPersonalizationResolvesBaselineWithNoPersonalizations() {
        let client = OptimizationClient()
        let baseline: [String: Any] = [
            "sys": ["id": "entry-1"],
            "fields": ["title": "Default Title"],
        ]

        // Without initialization, personalizeEntry returns baseline
        let result = client.personalizeEntry(baseline: baseline)
        XCTAssertEqual(result.entry["sys"] as? [String: String], ["id": "entry-1"])
        XCTAssertNil(result.personalization)
    }

    // MARK: - TimerStore Isolation Tests

    func testTimerStoreIsolation() {
        let storeA = NativePolyfills.TimerStore()
        let storeB = NativePolyfills.TimerStore()

        var firedA = false
        var firedB = false

        let itemA = DispatchWorkItem { firedA = true }
        let itemB = DispatchWorkItem { firedB = true }

        storeA.set(1, workItem: itemA)
        storeB.set(1, workItem: itemB)

        storeA.cancel(1)

        XCTAssertTrue(itemA.isCancelled, "Timer in store A should be cancelled")
        XCTAssertFalse(itemB.isCancelled, "Timer in store B should be unaffected")
        XCTAssertFalse(firedA)
        XCTAssertFalse(firedB)
    }

    func testTimerStoreCancelAll() {
        let store = NativePolyfills.TimerStore()

        let item1 = DispatchWorkItem {}
        let item2 = DispatchWorkItem {}
        let item3 = DispatchWorkItem {}

        store.set(1, workItem: item1)
        store.set(2, workItem: item2)
        store.set(3, workItem: item3)

        store.cancelAll()

        XCTAssertTrue(item1.isCancelled)
        XCTAssertTrue(item2.isCancelled)
        XCTAssertTrue(item3.isCancelled)
    }

    func testTimerStoreFiredRemovesEntry() {
        let store = NativePolyfills.TimerStore()
        let item = DispatchWorkItem {}

        store.set(42, workItem: item)
        store.fired(42)

        store.cancel(42)
        XCTAssertFalse(item.isCancelled, "After fired(), cancel() should be a no-op")
    }

    func testRegisterReturnsSeparateTimerStores() {
        let ctxA = JSContext()!
        let ctxB = JSContext()!

        let storeA = NativePolyfills.register(in: ctxA) { _, _ in }
        let storeB = NativePolyfills.register(in: ctxB) { _, _ in }

        XCTAssertFalse(storeA === storeB, "Each registration should produce a distinct TimerStore")
    }

    @MainActor
    func testDestroyedManagerCancelsTimers() throws {
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

    // MARK: - anonymousId persistence

    private func readStoredAnonymousId() -> String? {
        let suite = UserDefaults(suiteName: "com.contentful.optimization") ?? .standard
        guard let data = suite.data(forKey: "com.contentful.optimization.anonymousId") else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    @MainActor
    func testAnonymousIdPersistedOnProfileUpdate() async throws {
        let client = OptimizationClient()
        defer { client.destroy() }

        try client.initialize(config: OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/",
            defaults: StorageDefaults(profile: [
                "id": "abc-123", "stableId": "sid", "random": "r"
            ])
        ))

        try await Task.sleep(nanoseconds: 200_000_000)

        XCTAssertEqual(readStoredAnonymousId(), "abc-123",
                       "Profile.id must be written through to stored anonymousId")
    }

    @MainActor
    func testAnonymousIdPreservedWhenNewProfileHasNoId() async throws {
        let client = OptimizationClient()
        defer { client.destroy() }

        try client.initialize(config: OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/",
            defaults: StorageDefaults(profile: [
                "id": "first-id", "stableId": "sid", "random": "r"
            ])
        ))
        try await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertEqual(readStoredAnonymousId(), "first-id")

        client.testOnlyEvaluateScript("""
            __bridge.destroy();
            __bridge.initialize({
                clientId: "test-client",
                environment: "master",
                experienceBaseUrl: "http://localhost:8000/experience/",
                insightsBaseUrl: "http://localhost:8000/insights/",
                defaults: {
                    profile: { stableId: "sid", random: "r" }
                }
            });
        """)
        try await Task.sleep(nanoseconds: 200_000_000)

        XCTAssertEqual(readStoredAnonymousId(), "first-id",
                       "Previously-stored anonymousId must be preserved when new profile omits id")
    }

    // MARK: - changes array

    @MainActor
    func testChangesPopulatesAsArrayFromBridge() async throws {
        let client = OptimizationClient()
        defer { client.destroy() }

        try client.initialize(config: OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            experienceBaseUrl: "http://localhost:8000/experience/",
            insightsBaseUrl: "http://localhost:8000/insights/"
        ))

        client.testOnlyEvaluateScript("""
            __bridge.destroy();
            __bridge.initialize({
                clientId: "test-client",
                environment: "master",
                experienceBaseUrl: "http://localhost:8000/experience/",
                insightsBaseUrl: "http://localhost:8000/insights/",
                defaults: {
                    changes: [
                        { key: "hero.title", type: "Variable", meta: { experienceId: "exp-1", variantIndex: 1 }, value: "Hello" }
                    ]
                }
            });
        """)

        try await Task.sleep(nanoseconds: 200_000_000)

        XCTAssertNotNil(client.state.changes,
                        "state.changes must populate when bridge emits a ChangeArray")
        XCTAssertEqual(client.state.changes?.count, 1)
        XCTAssertEqual(client.state.changes?.first?["key"] as? String, "hero.title")
    }
}
