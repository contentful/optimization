import Foundation
import JavaScriptCore
import os

/// Manages the JSContext lifecycle: polyfill injection, UMD bundle loading, and bridge calls.
///
/// This is an internal implementation detail. Public API is exposed via `OptimizationClient`.
final class JSContextManager {
    private(set) var context: JSContext?
    let callbackManager = BridgeCallbackManager()
    private var timerStore: NativePolyfills.TimerStore?

    private static let signpostLog = OSLog(
        subsystem: "com.contentful.optimization",
        category: "Performance"
    )

    var onLog: ((String, String) -> Void)?
    var onStateChange: (([String: Any]) -> Void)?
    var onEvent: (([String: Any]) -> Void)?
    var onOverridesChanged: ((PreviewState) -> Void)?

    /// Creates the JSContext, loads polyfills and the UMD bundle, and calls `__bridge.initialize()`.
    func initialize(config: OptimizationConfig) throws {
        let log = Self.signpostLog
        let coldStartID = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: "Cold Start", signpostID: coldStartID)

        // Create context
        guard let ctx = JSContext() else {
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            throw OptimizationError.bridgeError("Failed to create JSContext")
        }

        ctx.exceptionHandler = { [weak self] _, exception in
            let msg = exception?.toString() ?? "Unknown JS error"
            self?.onLog?("exception", msg)
        }

        if #available(iOS 16.4, macOS 13.3, *) {
            ctx.isInspectable = true
        }

        // Register native polyfill functions
        timerStore = NativePolyfills.register(in: ctx) { [weak self] level, msg in
            self?.onLog?(level, msg)
        }

        // Evaluate JS polyfill scripts
        let polyfillScripts = try PolyfillScriptLoader.loadAll()
        for script in polyfillScripts {
            ctx.evaluateScript(script)
        }

        // Load UMD bundle
        let bundleSource = try loadBundleSource()
        ctx.evaluateScript(bundleSource)

        // Verify __bridge exists
        let bridgeCheck = ctx.evaluateScript("typeof __bridge")
        guard bridgeCheck?.toString() == "object" else {
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            throw OptimizationError.bridgeError(
                "__bridge not found after bundle evaluation (got: \(bridgeCheck?.toString() ?? "nil"))"
            )
        }

        // Register state change callback
        let onStateChange: @convention(block) (String) -> Void = { [weak self] json in
            self?.handleStateChange(json)
        }
        ctx.setObject(onStateChange, forKeyedSubscript: "__nativeOnStateChange" as NSString)

        // Register event callback
        let onEventEmitted: @convention(block) (String) -> Void = { [weak self] json in
            self?.handleEvent(json)
        }
        ctx.setObject(onEventEmitted, forKeyedSubscript: "__nativeOnEventEmitted" as NSString)

        // Register overrides-changed callback. The JS bridge calls
        // __nativeOnOverridesChanged(JSON.stringify(previewState)) after every
        // PreviewOverrideManager mutation — the "push model" that keeps iOS UI
        // in sync without polling getPreviewState() after each action.
        let onOverridesChangedBlock: @convention(block) (String) -> Void = { [weak self] json in
            self?.handleOverridesChanged(json)
        }
        ctx.setObject(onOverridesChangedBlock, forKeyedSubscript: "__nativeOnOverridesChanged" as NSString)

        // Initialize the bridge
        let configJSON: String
        do {
            configJSON = try config.toJSON()
        } catch {
            os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
            throw OptimizationError.configError("Failed to serialize config: \(error)")
        }

        ctx.evaluateScript("__bridge.initialize(\(configJSON))")

        self.context = ctx
        os_signpost(.end, log: log, name: "Cold Start", signpostID: coldStartID)
    }

    // MARK: - Bridge calls

    /// Calls an async bridge method with success/error callbacks.
    func callAsync(
        method: String,
        payload: String,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        guard let ctx = context else {
            completion(.failure(OptimizationError.notInitialized))
            return
        }

        var didComplete = false
        let completeOnce: (Result<String, Error>) -> Void = { result in
            guard !didComplete else { return }
            didComplete = true
            completion(result)
        }

        let names = callbackManager.registerCallback(
            in: ctx,
            prefix: method,
            onSuccess: { json in
                DispatchQueue.main.async {
                    completeOnce(.success(json))
                }
            },
            onError: { errorMsg in
                DispatchQueue.main.async {
                    completeOnce(.failure(OptimizationError.bridgeError(errorMsg)))
                }
            }
        )

        let args = payload.isEmpty
            ? "\(names.success), \(names.error)"
            : "\(payload), \(names.success), \(names.error)"

        var jsException: JSValue?
        let previousHandler = ctx.exceptionHandler
        ctx.exceptionHandler = { _, exception in
            jsException = exception
        }

        ctx.evaluateScript("__bridge.\(method)(\(args))")
        ctx.exceptionHandler = previousHandler

        if let exception = jsException {
            ctx.setObject(nil, forKeyedSubscript: names.success as NSString)
            ctx.setObject(nil, forKeyedSubscript: names.error as NSString)
            let msg = exception.toString() ?? "Unknown JS error"
            DispatchQueue.main.async {
                completeOnce(.failure(OptimizationError.bridgeError(msg)))
            }
        }
    }

    /// Calls a synchronous bridge method and returns the result.
    @discardableResult
    func callSync(method: String, args: String = "") -> JSValue? {
        guard let ctx = context else { return nil }
        let script = args.isEmpty ? "__bridge.\(method)()" : "__bridge.\(method)(\(args))"

        var jsException: JSValue?
        let previousHandler = ctx.exceptionHandler
        ctx.exceptionHandler = { _, exception in
            jsException = exception
        }

        let result = ctx.evaluateScript(script)
        ctx.exceptionHandler = previousHandler

        if let exception = jsException {
            let msg = exception.toString() ?? "Unknown JS error"
            onLog?("exception", "[\(method)] \(msg)")
            return nil
        }

        return result
    }

    /// Evaluates arbitrary JS in the context. Use sparingly.
    func evaluate(_ script: String) -> JSValue? {
        context?.evaluateScript(script)
    }

    /// Tears down the bridge, cancels pending timers, and releases the JSContext.
    func destroy() {
        timerStore?.cancelAll()
        timerStore = nil
        context?.evaluateScript("__bridge.destroy()")
        context = nil
    }

    // MARK: - Private

    private func loadBundleSource() throws -> String {
        guard let url = Bundle.module.url(
            forResource: "optimization-ios-bridge.umd",
            withExtension: "js"
        ) else {
            throw OptimizationError.resourceLoadError(
                "optimization-ios-bridge.umd.js not found in package resources"
            )
        }
        do {
            return try String(contentsOf: url, encoding: .utf8)
        } catch {
            throw OptimizationError.resourceLoadError(
                "Failed to read UMD bundle: \(error.localizedDescription)"
            )
        }
    }

    private func handleStateChange(_ json: String) {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        DispatchQueue.main.async { [weak self] in
            self?.onStateChange?(dict)
        }
    }

    private func handleEvent(_ json: String) {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }

        DispatchQueue.main.async { [weak self] in
            self?.onEvent?(dict)
        }
    }

    private func handleOverridesChanged(_ json: String) {
        guard let data = json.data(using: .utf8),
              let state = try? JSONDecoder().decode(PreviewState.self, from: data)
        else { return }

        DispatchQueue.main.async { [weak self] in
            self?.onOverridesChanged?(state)
        }
    }
}
