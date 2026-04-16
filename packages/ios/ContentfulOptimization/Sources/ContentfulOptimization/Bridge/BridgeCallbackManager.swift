import Foundation
import JavaScriptCore

/// Manages one-shot callback pairs registered into the JSContext for async bridge calls.
///
/// Each async JS bridge method (identify, page, etc.) needs a unique pair of
/// `onSuccess`/`onError` global functions. This manager generates unique IDs,
/// registers the closures into the JSContext, and auto-cleans them after invocation.
final class BridgeCallbackManager {
    private var nextId: Int = 1
    private let lock = NSLock()

    /// Registers a one-shot success/error callback pair in the given JSContext.
    ///
    /// - Parameters:
    ///   - context: The JSContext to register callbacks in.
    ///   - prefix: A descriptive prefix for the callback name (e.g., "identify", "page").
    ///   - onSuccess: Called with the JSON string result on success.
    ///   - onError: Called with the error message on failure.
    /// - Returns: A tuple of `(successName, errorName)` to use in the JS bridge call.
    func registerCallback(
        in context: JSContext,
        prefix: String,
        onSuccess: @escaping (String) -> Void,
        onError: @escaping (String) -> Void
    ) -> (success: String, error: String) {
        let id = nextCallbackId()
        let successName = "__\(prefix)Callback_\(id)_success"
        let errorName = "__\(prefix)Callback_\(id)_error"

        let successBlock: @convention(block) (String) -> Void = { [weak context] json in
            onSuccess(json)
            context?.setObject(nil, forKeyedSubscript: successName as NSString)
            context?.setObject(nil, forKeyedSubscript: errorName as NSString)
        }

        let errorBlock: @convention(block) (String) -> Void = { [weak context] errorMsg in
            onError(errorMsg)
            context?.setObject(nil, forKeyedSubscript: successName as NSString)
            context?.setObject(nil, forKeyedSubscript: errorName as NSString)
        }

        context.setObject(successBlock, forKeyedSubscript: successName as NSString)
        context.setObject(errorBlock, forKeyedSubscript: errorName as NSString)

        return (successName, errorName)
    }

    private func nextCallbackId() -> Int {
        lock.lock()
        defer { lock.unlock() }
        let id = nextId
        nextId += 1
        return id
    }
}
