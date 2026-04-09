import Foundation
import JavaScriptCore
import os

/// Registers native Swift functions into a JSContext to back the JS polyfill scripts.
enum NativePolyfills {

    /// Per-context store for active timer work items, preventing cross-context collisions.
    final class TimerStore {
        private var timers: [Int: DispatchWorkItem] = [:]

        func set(_ id: Int, workItem: DispatchWorkItem) {
            timers[id] = workItem
        }

        func cancel(_ id: Int) {
            timers[id]?.cancel()
            timers.removeValue(forKey: id)
        }

        func fired(_ id: Int) {
            timers.removeValue(forKey: id)
        }

        /// Cancels all pending timers. Call when the owning context is destroyed.
        func cancelAll() {
            for (_, workItem) in timers {
                workItem.cancel()
            }
            timers.removeAll()
        }
    }

    /// Escapes a Swift string so it can be safely interpolated into a JS string literal.
    static func escapeForJS(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }

    private static let signpostLog = OSLog(
        subsystem: "com.contentful.optimization",
        category: "Performance"
    )

    /// Register all native polyfill functions into the given JSContext.
    ///
    /// Returns a ``TimerStore`` that the caller must retain for the lifetime of
    /// the context and call ``TimerStore/cancelAll()`` on teardown.
    @discardableResult
    static func register(
        in context: JSContext,
        logger: @escaping (String, String) -> Void
    ) -> TimerStore {
        let timerStore = TimerStore()
        weak var weakContext = context

        // MARK: - __nativeLog(level, msg)

        let nativeLog: @convention(block) (String, String) -> Void = { level, msg in
            logger(level, msg)
        }
        context.setObject(nativeLog, forKeyedSubscript: "__nativeLog" as NSString)

        // MARK: - __nativeSetTimeout(id, delayMs)

        let nativeSetTimeout: @convention(block) (Int, Int) -> Void = { timerId, delayMs in
            let workItem = DispatchWorkItem {
                guard let ctx = weakContext else { return }
                timerStore.fired(timerId)
                ctx.evaluateScript("__timerFired(\(timerId))")
            }
            timerStore.set(timerId, workItem: workItem)
            DispatchQueue.main.asyncAfter(
                deadline: .now() + .milliseconds(max(delayMs, 0)),
                execute: workItem
            )
        }
        context.setObject(nativeSetTimeout, forKeyedSubscript: "__nativeSetTimeout" as NSString)

        // MARK: - __nativeClearTimeout(id)

        let nativeClearTimeout: @convention(block) (Int) -> Void = { timerId in
            timerStore.cancel(timerId)
        }
        context.setObject(nativeClearTimeout, forKeyedSubscript: "__nativeClearTimeout" as NSString)

        // MARK: - __nativeRandomUUID()

        let nativeRandomUUID: @convention(block) () -> String = {
            UUID().uuidString.lowercased()
        }
        context.setObject(nativeRandomUUID, forKeyedSubscript: "__nativeRandomUUID" as NSString)

        // MARK: - __nativeFetch(url, method, headersJSON, body, callbackId)

        let nativeFetch: @convention(block) (String, String, String, JSValue, Int) -> Void = {
            urlString, method, headersJSON, bodyValue, callbackId in

            let diagLog = DiagnosticLogger.shared
            diagLog.debug("[fetch] \(method) \(urlString)")

            let log = NativePolyfills.signpostLog
            let fetchSignpostID = OSSignpostID(log: log)
            os_signpost(
                .begin, log: log, name: "Fetch Bridge Crossing",
                signpostID: fetchSignpostID, "%{public}s %{public}s", method, urlString
            )

            guard let url = Foundation.URL(string: urlString) else {
                diagLog.error("[fetch] Invalid URL: \(urlString)")
                DispatchQueue.main.async {
                    let escaped = NativePolyfills.escapeForJS(urlString)
                    weakContext?.evaluateScript(
                        "__fetchComplete(\(callbackId), 0, \"{}\", \"\", \"Invalid URL: \(escaped)\")"
                    )
                    os_signpost(
                        .end, log: log, name: "Fetch Bridge Crossing",
                        signpostID: fetchSignpostID, "error: invalid URL"
                    )
                }
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = method

            if let data = headersJSON.data(using: .utf8),
               let headers = try? JSONSerialization.jsonObject(with: data) as? [String: String]
            {
                for (key, value) in headers {
                    request.setValue(value, forHTTPHeaderField: key)
                }
            }

            if !bodyValue.isNull && !bodyValue.isUndefined, let bodyString = bodyValue.toString() {
                request.httpBody = bodyString.data(using: .utf8)
            }

            URLSession.shared.dataTask(with: request) { data, response, error in
                DispatchQueue.main.async {
                    guard let ctx = weakContext else {
                        diagLog.warning("[fetch] Context deallocated before response for \(urlString)")
                        os_signpost(
                            .end, log: log, name: "Fetch Bridge Crossing",
                            signpostID: fetchSignpostID, "context deallocated"
                        )
                        return
                    }

                    if let error = error {
                        diagLog.error("[fetch] Network error for \(urlString): \(error.localizedDescription)")
                        let escaped = NativePolyfills.escapeForJS(
                            error.localizedDescription
                        )
                        ctx.evaluateScript(
                            "__fetchComplete(\(callbackId), 0, \"{}\", \"\", \"\(escaped)\")"
                        )
                        os_signpost(
                            .end, log: log, name: "Fetch Bridge Crossing",
                            signpostID: fetchSignpostID, "error: %{public}s", escaped
                        )
                        return
                    }

                    let httpResponse = response as? HTTPURLResponse
                    let statusCode = httpResponse?.statusCode ?? 0
                    let bodySize = data?.count ?? 0
                    diagLog.debug("[fetch] Response \(statusCode) from \(urlString) (\(bodySize) bytes)")
                    if statusCode >= 400, let data = data, let body = String(data: data, encoding: .utf8) {
                        diagLog.error("[fetch] Error body: \(body)")
                    }

                    var responseHeaders: [String: String] = [:]
                    if let allHeaders = httpResponse?.allHeaderFields as? [String: String] {
                        responseHeaders = allHeaders
                    }
                    let headersJSONStr = (try? JSONSerialization.data(
                        withJSONObject: responseHeaders
                    )).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

                    let bodyText = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""

                    let escapedBody = NativePolyfills.escapeForJS(bodyText)
                    let escapedHeaders = NativePolyfills.escapeForJS(headersJSONStr)

                    ctx.evaluateScript(
                        "__fetchComplete(\(callbackId), \(statusCode), \"\(escapedHeaders)\", \"\(escapedBody)\", \"\")"
                    )
                    os_signpost(
                        .end, log: log, name: "Fetch Bridge Crossing",
                        signpostID: fetchSignpostID, "status: %d", statusCode
                    )
                }
            }.resume()
        }
        context.setObject(nativeFetch, forKeyedSubscript: "__nativeFetch" as NSString)

        return timerStore
    }
}
