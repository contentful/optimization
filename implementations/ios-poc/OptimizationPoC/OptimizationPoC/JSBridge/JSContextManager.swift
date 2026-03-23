import Foundation
import JavaScriptCore
import os

/// Decoded state snapshot pushed from JS signals via `effect()`.
struct BridgeState: Equatable {
    var profile: String?
    var consent: Bool?
    var canPersonalize: Bool
    var changes: String?

    static let empty = BridgeState(profile: nil, consent: nil, canPersonalize: false, changes: nil)
}

/// Orchestrates the JSContext lifecycle: polyfill injection, bundle loading, and bridge calls.
@MainActor
class JSContextManager: ObservableObject {

    @Published var logs: [String] = []
    @Published var isInitialized = false
    @Published var state = BridgeState.empty

    private var context: JSContext?

    static let signpostLog = OSLog(subsystem: "com.contentful.optimization.poc", category: "Performance")

    // MARK: - Configuration

    private let config: [String: String] = [
        "clientId": "mock-client-id",
        "environment": "main",
        "experienceBaseUrl": "http://localhost:8000/experience/",
        "insightsBaseUrl": "http://localhost:8000/insights/",
    ]

    // MARK: - Public API

    /// Create the JSContext, load polyfills and the UMD bundle, and call `__bridge.initialize()`.
    func initialize() {
        let log = JSContextManager.signpostLog
        let coldStartID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "Cold Start", signpostID: coldStartID)

        appendLog("[Swift] Creating JSContext...")

        let contextCreateID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "JSContext Creation", signpostID: contextCreateID)

        let ctx = JSContext()!

        // Exception handler
        ctx.exceptionHandler = { [weak self] _, exception in
            let msg = exception?.toString() ?? "Unknown JS error"
            DispatchQueue.main.async {
                self?.appendLog("[JS Exception] \(msg)")
            }
        }

        // Enable Safari Web Inspector for debugging (iOS 16.4+)
        if #available(iOS 16.4, *) {
            ctx.isInspectable = true
        }

        os_signpost(.end, log: log, name: "JSContext Creation", signpostID: contextCreateID)

        // Register native polyfill functions
        let nativePolyfillID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "Native Polyfill Registration", signpostID: nativePolyfillID)

        Polyfills.register(in: ctx) { [weak self] level, msg in
            DispatchQueue.main.async {
                self?.appendLog("[JS \(level)] \(msg)")
            }
        }

        os_signpost(.end, log: log, name: "Native Polyfill Registration", signpostID: nativePolyfillID)

        // Evaluate JS polyfill scripts
        let jsPolyfillID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "JS Polyfill Evaluation", signpostID: jsPolyfillID)

        for script in PolyfillScripts.all {
            ctx.evaluateScript(script)
        }

        os_signpost(.end, log: log, name: "JS Polyfill Evaluation", signpostID: jsPolyfillID)

        // Load the UMD bundle
        let umdBundleID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "UMD Bundle Evaluation", signpostID: umdBundleID)

        guard let bundlePath = Bundle.main.path(
            forResource: "optimization-ios-bridge.umd",
            ofType: "js"
        ) else {
            os_signpost(.end, log: log, name: "UMD Bundle Evaluation", signpostID: umdBundleID)
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            appendLog("[Swift] ERROR: Bundle file not found in app resources")
            return
        }

        do {
            let bundleSource = try String(contentsOfFile: bundlePath, encoding: .utf8)
            appendLog("[Swift] Evaluating bundle (\(bundleSource.count) chars)...")
            ctx.evaluateScript(bundleSource)
        } catch {
            os_signpost(.end, log: log, name: "UMD Bundle Evaluation", signpostID: umdBundleID)
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            appendLog("[Swift] ERROR loading bundle: \(error.localizedDescription)")
            return
        }

        os_signpost(.end, log: log, name: "UMD Bundle Evaluation", signpostID: umdBundleID)

        // Verify __bridge exists
        let bridgeCheck = ctx.evaluateScript("typeof __bridge")
        guard bridgeCheck?.toString() == "object" else {
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            appendLog("[Swift] ERROR: __bridge not found after bundle evaluation (got: \(bridgeCheck?.toString() ?? "nil"))")
            return
        }

        // Register state change callback
        let onStateChange: @convention(block) (String) -> Void = { [weak self] json in
            DispatchQueue.main.async {
                self?.handleStateChange(json)
            }
        }
        ctx.setObject(onStateChange, forKeyedSubscript: "__nativeOnStateChange" as NSString)

        // Call __bridge.initialize(config)
        let sdkInitID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "SDK Initialize", signpostID: sdkInitID)

        let configJSON: String
        do {
            let data = try JSONSerialization.data(withJSONObject: config)
            configJSON = String(data: data, encoding: .utf8) ?? "{}"
        } catch {
            os_signpost(.end, log: log, name: "SDK Initialize", signpostID: sdkInitID)
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            appendLog("[Swift] ERROR serializing config: \(error)")
            return
        }

        ctx.evaluateScript("__bridge.initialize(\(configJSON))")

        os_signpost(.end, log: log, name: "SDK Initialize", signpostID: sdkInitID)

        self.context = ctx
        self.isInitialized = true
        appendLog("[Swift] SDK initialized successfully")

        os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
    }

    /// Call `__bridge.identify(payload)` with a one-shot callback pair.
    func identify(userId: String, completion: @escaping (Result<String, Error>) -> Void) {
        guard let ctx = context else {
            completion(.failure(BridgeError.notInitialized))
            return
        }

        let callbackId = "__identifyCallback_\(Int.random(in: 1000...9999))"

        let onSuccess: @convention(block) (String) -> Void = { [weak self] json in
            DispatchQueue.main.async {
                self?.appendLog("[Swift] identify succeeded")
                completion(.success(json))
            }
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_success" as NSString)
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_error" as NSString)
        }

        let onError: @convention(block) (String) -> Void = { [weak self] errorMsg in
            DispatchQueue.main.async {
                self?.appendLog("[Swift] identify failed: \(errorMsg)")
                completion(.failure(BridgeError.jsBridgeError(errorMsg)))
            }
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_success" as NSString)
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_error" as NSString)
        }

        ctx.setObject(onSuccess, forKeyedSubscript: "\(callbackId)_success" as NSString)
        ctx.setObject(onError, forKeyedSubscript: "\(callbackId)_error" as NSString)

        let payload = "{\"userId\":\"\(userId)\"}"
        ctx.evaluateScript(
            "__bridge.identify(\(payload), \(callbackId)_success, \(callbackId)_error)"
        )
    }

    /// Call `__bridge.page(payload)` with a one-shot callback pair.
    func page(completion: @escaping (Result<String, Error>) -> Void) {
        guard let ctx = context else {
            completion(.failure(BridgeError.notInitialized))
            return
        }

        let callbackId = "__pageCallback_\(Int.random(in: 1000...9999))"

        let onSuccess: @convention(block) (String) -> Void = { [weak self] json in
            DispatchQueue.main.async {
                self?.appendLog("[Swift] page succeeded")
                completion(.success(json))
            }
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_success" as NSString)
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_error" as NSString)
        }

        let onError: @convention(block) (String) -> Void = { [weak self] errorMsg in
            DispatchQueue.main.async {
                self?.appendLog("[Swift] page failed: \(errorMsg)")
                completion(.failure(BridgeError.jsBridgeError(errorMsg)))
            }
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_success" as NSString)
            ctx.setObject(nil, forKeyedSubscript: "\(callbackId)_error" as NSString)
        }

        ctx.setObject(onSuccess, forKeyedSubscript: "\(callbackId)_success" as NSString)
        ctx.setObject(onError, forKeyedSubscript: "\(callbackId)_error" as NSString)

        ctx.evaluateScript(
            "__bridge.page({}, \(callbackId)_success, \(callbackId)_error)"
        )
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
        state = .empty
        appendLog("[Swift] SDK destroyed")
    }

    // MARK: - State observation

    private func handleStateChange(_ json: String) {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        let profileValue = dict["profile"]
        let profile: String? = if profileValue is NSNull || profileValue == nil {
            nil
        } else if let profileData = try? JSONSerialization.data(withJSONObject: profileValue!),
                  let profileStr = String(data: profileData, encoding: .utf8) {
            profileStr
        } else {
            nil
        }

        let changesValue = dict["changes"]
        let changes: String? = if changesValue is NSNull || changesValue == nil {
            nil
        } else if let changesData = try? JSONSerialization.data(withJSONObject: changesValue!),
                  let changesStr = String(data: changesData, encoding: .utf8) {
            changesStr
        } else {
            nil
        }

        state = BridgeState(
            profile: profile,
            consent: dict["consent"] as? Bool,
            canPersonalize: dict["canPersonalize"] as? Bool ?? false,
            changes: changes
        )

        appendLog("[Swift] State updated — consent: \(state.consent?.description ?? "nil"), canPersonalize: \(state.canPersonalize), profile: \(profile != nil ? "present" : "nil")")
    }

    // MARK: - Logging

    private func appendLog(_ message: String) {
        logs.append(message)
        print(message)
    }
}

// MARK: - Errors

enum BridgeError: LocalizedError {
    case notInitialized
    case jsBridgeError(String)

    var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "SDK not initialized. Call initialize() first."
        case .jsBridgeError(let msg):
            return msg
        }
    }
}
