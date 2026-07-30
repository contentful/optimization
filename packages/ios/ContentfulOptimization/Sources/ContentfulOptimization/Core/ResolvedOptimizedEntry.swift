import Foundation

/// The result of resolving an optimized entry.
public struct ResolvedOptimizedEntry {
    public let entry: [String: Any]
    public let selectedOptimization: [String: Any]?
    public let optimizationContextId: String?
}

/// The result of resolving an optimized entry that was passed in as a `Contentful.Entry` — the
/// `Contentful.Entry`-typed counterpart to `ResolvedOptimizedEntry`. `entry` is a `ResolvedEntry`
/// (typed `getField` reads) rather than a raw `[String: Any]`, matching how
/// `OptimizedEntry(entry: Contentful.Entry, ...)` hands its render closure a `ResolvedEntry`
/// instead of a dict.
public struct ResolvedContentfulOptimizedEntry {
    public let entry: ResolvedEntry
    public let selectedOptimization: [String: Any]?
    public let optimizationContextId: String?
}
