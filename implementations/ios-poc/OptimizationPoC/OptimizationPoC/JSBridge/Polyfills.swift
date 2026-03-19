import Foundation
import JavaScriptCore

/// Registers native Swift functions into a JSContext to back the JS polyfill scripts.
enum Polyfills {

    /// Active timer work items keyed by timer ID.
    private static var timers: [Int: DispatchWorkItem] = [:]

    /// Register all native polyfill functions into the given JSContext.
    static func register(in context: JSContext, logger: @escaping (String, String) -> Void) {

        // MARK: - __nativeLog(level, msg)

        let nativeLog: @convention(block) (String, String) -> Void = { level, msg in
            logger(level, msg)
        }
        context.setObject(nativeLog, forKeyedSubscript: "__nativeLog" as NSString)

        // MARK: - __nativeSetTimeout(id, delayMs)

        let nativeSetTimeout: @convention(block) (Int, Int) -> Void = { timerId, delayMs in
            let workItem = DispatchWorkItem { [weak context] in
                guard let ctx = context else { return }
                Polyfills.timers.removeValue(forKey: timerId)
                ctx.evaluateScript("__timerFired(\(timerId))")
            }
            Polyfills.timers[timerId] = workItem
            DispatchQueue.main.asyncAfter(
                deadline: .now() + .milliseconds(max(delayMs, 0)),
                execute: workItem
            )
        }
        context.setObject(nativeSetTimeout, forKeyedSubscript: "__nativeSetTimeout" as NSString)

        // MARK: - __nativeClearTimeout(id)

        let nativeClearTimeout: @convention(block) (Int) -> Void = { timerId in
            Polyfills.timers[timerId]?.cancel()
            Polyfills.timers.removeValue(forKey: timerId)
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

            guard let url = Foundation.URL(string: urlString) else {
                DispatchQueue.main.async { [weak context] in
                    context?.evaluateScript(
                        "__fetchComplete(\(callbackId), 0, \"{}\", \"\", \"Invalid URL: \(urlString.replacingOccurrences(of: "\"", with: "\\\""))\")"
                    )
                }
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = method

            // Parse headers
            if let data = headersJSON.data(using: .utf8),
               let headers = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                for (key, value) in headers {
                    request.setValue(value, forHTTPHeaderField: key)
                }
            }

            // Body
            if !bodyValue.isNull && !bodyValue.isUndefined, let bodyString = bodyValue.toString() {
                request.httpBody = bodyString.data(using: .utf8)
            }

            URLSession.shared.dataTask(with: request) { [weak context] data, response, error in
                DispatchQueue.main.async {
                    guard let ctx = context else { return }

                    if let error = error {
                        let escaped = error.localizedDescription
                            .replacingOccurrences(of: "\\", with: "\\\\")
                            .replacingOccurrences(of: "\"", with: "\\\"")
                            .replacingOccurrences(of: "\n", with: "\\n")
                        ctx.evaluateScript(
                            "__fetchComplete(\(callbackId), 0, \"{}\", \"\", \"\(escaped)\")"
                        )
                        return
                    }

                    let httpResponse = response as? HTTPURLResponse
                    let statusCode = httpResponse?.statusCode ?? 0

                    // Response headers
                    var responseHeaders: [String: String] = [:]
                    if let allHeaders = httpResponse?.allHeaderFields as? [String: String] {
                        responseHeaders = allHeaders
                    }
                    let headersJSONStr = (try? JSONSerialization.data(
                        withJSONObject: responseHeaders
                    )).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

                    // Body text
                    let bodyText = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""

                    // Escape for JS string literal
                    let escapedBody = bodyText
                        .replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "\"", with: "\\\"")
                        .replacingOccurrences(of: "\n", with: "\\n")
                        .replacingOccurrences(of: "\r", with: "\\r")
                        .replacingOccurrences(of: "\t", with: "\\t")
                    let escapedHeaders = headersJSONStr
                        .replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "\"", with: "\\\"")

                    ctx.evaluateScript(
                        "__fetchComplete(\(callbackId), \(statusCode), \"\(escapedHeaders)\", \"\(escapedBody)\", \"\")"
                    )
                }
            }.resume()
        }
        context.setObject(nativeFetch, forKeyedSubscript: "__nativeFetch" as NSString)
    }
}
