import Foundation

/// The result of resolving an optimized entry.
public struct ResolvedOptimizedEntry {
    public let entry: [String: Any]
    public let selectedOptimization: [String: Any]?
    public let optimizationContextId: String?
}
