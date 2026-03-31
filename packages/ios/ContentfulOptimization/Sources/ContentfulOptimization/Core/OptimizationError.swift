import Foundation

/// Errors thrown by the Contentful Optimization SDK.
public enum OptimizationError: LocalizedError {
    /// The SDK has not been initialized. Call `initialize()` first.
    case notInitialized
    /// An error occurred in the JavaScript bridge.
    case bridgeError(String)
    /// The UMD bundle or polyfill resources could not be loaded.
    case resourceLoadError(String)
    /// Configuration serialization failed.
    case configError(String)

    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "SDK not initialized. Call initialize() first."
        case .bridgeError(let msg):
            return "JS Bridge error: \(msg)"
        case .resourceLoadError(let msg):
            return "Resource load error: \(msg)"
        case .configError(let msg):
            return "Config error: \(msg)"
        }
    }
}
