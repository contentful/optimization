import Foundation
import JavaScriptCore
@testable import OptimizationPoC

/// Per-phase timing results from `initializeWithTimings()`.
struct Timings {
    var contextCreation: CFAbsoluteTime = 0
    var nativePolyfillRegistration: CFAbsoluteTime = 0
    var jsPolyfillEvaluation: CFAbsoluteTime = 0
    var umdBundleEvaluation: CFAbsoluteTime = 0
    var sdkInitialize: CFAbsoluteTime = 0
    var total: CFAbsoluteTime = 0

    func asJSON() -> String {
        """
        {"contextCreation":\(contextCreation),"nativePolyfillRegistration":\(nativePolyfillRegistration),\
        "jsPolyfillEvaluation":\(jsPolyfillEvaluation),"umdBundleEvaluation":\(umdBundleEvaluation),\
        "sdkInitialize":\(sdkInitialize),"total":\(total)}
        """
    }
}

/// Test-only JSContext harness that mirrors `JSContextManager.initialize()` without
/// `@MainActor` or `ObservableObject` constraints. Designed for XCTest performance tests.
class PerfTestJSContextManager {

    private(set) var context: JSContext?
    private(set) var isInitialized = false
    private let stubFetch: Bool

    private let config: [String: String] = [
        "clientId": "mock-client-id",
        "environment": "main",
        "experienceBaseUrl": "http://localhost:8000/experience/",
        "insightsBaseUrl": "http://localhost:8000/insights/",
    ]

    init(stubFetch: Bool = false) {
        self.stubFetch = stubFetch
    }

    // MARK: - Resource Loading

    /// Load polyfill scripts from the host app bundle (not Bundle.main, which differs in test targets).
    private func loadPolyfillScripts() -> [String] {
        let bundle = hostAppBundle()
        let fileNames = [
            "console", "timers", "fetch", "crypto", "url",
            "abort-controller", "promise-utilities", "text-encoding",
        ]
        return fileNames.map { name in
            guard let url = bundle.url(forResource: name, withExtension: "js", subdirectory: "polyfills") else {
                fatalError("Missing polyfill resource: polyfills/\(name).js")
            }
            do {
                return try String(contentsOf: url, encoding: .utf8)
            } catch {
                fatalError("Failed to read polyfill polyfills/\(name).js: \(error)")
            }
        }
    }

    /// Load the UMD bundle source from the host app bundle.
    private func loadUMDBundle() -> String? {
        let bundle = hostAppBundle()
        guard let path = bundle.path(forResource: "optimization-ios-bridge.umd", ofType: "js") else {
            return nil
        }
        return try? String(contentsOfFile: path, encoding: .utf8)
    }

    /// Returns the host app bundle. In hosted test targets, `Bundle.main` is the app bundle.
    /// Falls back to searching for the .app bundle if needed.
    private func hostAppBundle() -> Bundle {
        // In hosted tests, Bundle.main is the host app bundle
        if Bundle.main.bundleIdentifier == "com.contentful.optimization.poc" {
            return Bundle.main
        }
        // Fallback: search for the app bundle within the test runner
        let testBundle = Bundle(for: type(of: self))
        if let appBundlePath = testBundle.path(forResource: "OptimizationPoC", ofType: "app") {
            return Bundle(path: appBundlePath) ?? Bundle.main
        }
        return Bundle.main
    }

    // MARK: - Initialize

    /// Standard initialization matching `JSContextManager.initialize()`.
    func initialize() {
        _ = initializeWithTimings()
    }

    /// Initialize and return per-phase timing breakdown.
    func initializeWithTimings() -> Timings {
        var timings = Timings()
        let totalStart = CFAbsoluteTimeGetCurrent()

        // JSContext Creation
        var phaseStart = CFAbsoluteTimeGetCurrent()
        let ctx = JSContext()!
        ctx.exceptionHandler = { _, exception in
            let msg = exception?.toString() ?? "Unknown JS error"
            print("[PerfTest JS Exception] \(msg)")
        }
        timings.contextCreation = CFAbsoluteTimeGetCurrent() - phaseStart

        // Native Polyfill Registration
        phaseStart = CFAbsoluteTimeGetCurrent()
        Polyfills.register(in: ctx) { level, msg in
            print("[PerfTest JS \(level)] \(msg)")
        }
        if stubFetch {
            registerStubFetch(in: ctx)
        }
        timings.nativePolyfillRegistration = CFAbsoluteTimeGetCurrent() - phaseStart

        // JS Polyfill Evaluation
        phaseStart = CFAbsoluteTimeGetCurrent()
        for script in loadPolyfillScripts() {
            ctx.evaluateScript(script)
        }
        timings.jsPolyfillEvaluation = CFAbsoluteTimeGetCurrent() - phaseStart

        // UMD Bundle Evaluation
        phaseStart = CFAbsoluteTimeGetCurrent()
        guard let bundleSource = loadUMDBundle() else {
            print("[PerfTest] ERROR: Bundle file not found")
            timings.umdBundleEvaluation = CFAbsoluteTimeGetCurrent() - phaseStart
            timings.total = CFAbsoluteTimeGetCurrent() - totalStart
            return timings
        }
        ctx.evaluateScript(bundleSource)
        timings.umdBundleEvaluation = CFAbsoluteTimeGetCurrent() - phaseStart

        // Verify __bridge exists
        let bridgeCheck = ctx.evaluateScript("typeof __bridge")
        guard bridgeCheck?.toString() == "object" else {
            print("[PerfTest] ERROR: __bridge not found")
            timings.total = CFAbsoluteTimeGetCurrent() - totalStart
            return timings
        }

        // Register state change callback (no-op for tests)
        let onStateChange: @convention(block) (String) -> Void = { _ in }
        ctx.setObject(onStateChange, forKeyedSubscript: "__nativeOnStateChange" as NSString)

        // SDK Initialize
        phaseStart = CFAbsoluteTimeGetCurrent()
        let configJSON: String
        do {
            let data = try JSONSerialization.data(withJSONObject: config)
            configJSON = String(data: data, encoding: .utf8) ?? "{}"
        } catch {
            print("[PerfTest] ERROR serializing config: \(error)")
            timings.sdkInitialize = CFAbsoluteTimeGetCurrent() - phaseStart
            timings.total = CFAbsoluteTimeGetCurrent() - totalStart
            return timings
        }
        ctx.evaluateScript("__bridge.initialize(\(configJSON))")
        timings.sdkInitialize = CFAbsoluteTimeGetCurrent() - phaseStart

        self.context = ctx
        self.isInitialized = true
        timings.total = CFAbsoluteTimeGetCurrent() - totalStart
        return timings
    }

    // MARK: - Stub Fetch

    /// Registers a `__nativeFetch` that immediately calls `__fetchComplete` with canned JSON.
    private func registerStubFetch(in ctx: JSContext) {
        let stubFetch: @convention(block) (String, String, String, JSValue, Int) -> Void = {
            [weak ctx] _, _, _, _, callbackId in
            let responseBody = "{\\\"ok\\\":true}"
            let responseHeaders = "{}"
            ctx?.evaluateScript(
                "__fetchComplete(\(callbackId), 200, \"\(responseHeaders)\", \"\(responseBody)\", \"\")"
            )
        }
        ctx.setObject(stubFetch, forKeyedSubscript: "__nativeFetch" as NSString)
    }

    // MARK: - Synchronous Wrappers

    /// Call `__bridge.identify(payload)` synchronously by pumping the RunLoop.
    func identifySynchronously(userId: String, timeout: TimeInterval = 5.0) -> String? {
        guard let ctx = context else { return nil }

        var result: String?
        var completed = false

        let callbackId = "__perfIdentify_\(Int.random(in: 1000...9999))"
        let onSuccess: @convention(block) (String) -> Void = { json in
            result = json
            completed = true
        }
        let onError: @convention(block) (String) -> Void = { errorMsg in
            result = "ERROR: \(errorMsg)"
            completed = true
        }

        ctx.setObject(onSuccess, forKeyedSubscript: "\(callbackId)_success" as NSString)
        ctx.setObject(onError, forKeyedSubscript: "\(callbackId)_error" as NSString)

        let payload = "{\"userId\":\"\(userId)\"}"
        ctx.evaluateScript("__bridge.identify(\(payload), \(callbackId)_success, \(callbackId)_error)")

        let deadline = Date().addingTimeInterval(timeout)
        while !completed && Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.01))
        }

        ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_success" as NSString)
        ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_error" as NSString)

        return result
    }

    /// Call `__bridge.page(payload)` synchronously by pumping the RunLoop.
    func pageSynchronously(timeout: TimeInterval = 5.0) -> String? {
        guard let ctx = context else { return nil }

        var result: String?
        var completed = false

        let callbackId = "__perfPage_\(Int.random(in: 1000...9999))"
        let onSuccess: @convention(block) (String) -> Void = { json in
            result = json
            completed = true
        }
        let onError: @convention(block) (String) -> Void = { errorMsg in
            result = "ERROR: \(errorMsg)"
            completed = true
        }

        ctx.setObject(onSuccess, forKeyedSubscript: "\(callbackId)_success" as NSString)
        ctx.setObject(onError, forKeyedSubscript: "\(callbackId)_error" as NSString)

        ctx.evaluateScript("__bridge.page({}, \(callbackId)_success, \(callbackId)_error)")

        let deadline = Date().addingTimeInterval(timeout)
        while !completed && Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.01))
        }

        ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_success" as NSString)
        ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_error" as NSString)

        return result
    }

    /// Synchronously read the current profile from signals.
    func getProfile() -> String {
        guard let ctx = context else { return "Not initialized" }
        let result = ctx.evaluateScript("__bridge.getProfile()")
        return result?.toString() ?? "null"
    }

    /// Tear down the bridge and release the JSContext.
    func destroy() {
        context?.evaluateScript("__bridge.destroy()")
        context = nil
        isInitialized = false
    }
}
