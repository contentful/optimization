import Foundation

/// The result of resolving an optimized entry. `entry` is a `CTEntry` — `getField`, not `as?`
/// casts on a raw map — regardless of whether the baseline passed to `resolveOptimizedEntry` was
/// a raw `[String: Any]` or a `Contentful.Entry`; both overloads wrap their result the same way.
public struct ResolvedOptimizedEntry {
    public let entry: CTEntry
    public let selectedOptimization: [String: Any]?
    public let optimizationContextId: String?
}
