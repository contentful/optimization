import CoreFoundation
import Foundation

/// The result of resolving an optimized entry. `entry` is a `CTEntry` — `getField`, not `as?`
/// casts on a raw map — regardless of whether the baseline passed to `resolveOptimizedEntry` was
/// a raw `[String: Any]` or a `Contentful.Entry`; both overloads wrap their result the same way.
public struct ResolvedOptimizedEntry {
    public let entry: CTEntry
    public let selectedOptimization: [String: Any]?
    public let optimizationContextId: String?
    public let isEmptyVariant: Bool

    init(
        entry: CTEntry,
        selectedOptimization: [String: Any]?,
        optimizationContextId: String?,
        isEmptyVariant: Bool = false
    ) {
        self.entry = entry
        self.selectedOptimization = selectedOptimization
        self.optimizationContextId = optimizationContextId
        self.isEmptyVariant = isEmptyVariant
    }

    static func fromBridgeResult(
        _ result: [String: Any],
        baselineEntry: CTEntry
    ) -> ResolvedOptimizedEntry {
        let rawIsEmptyVariant = result["isEmptyVariant"] as? NSNumber
        return ResolvedOptimizedEntry(
            entry: CTEntry(
                any: result["entry"] as? [String: Any] ?? baselineEntry.toDictionary(),
                fallback: baselineEntry
            ),
            selectedOptimization: result["selectedOptimization"] as? [String: Any],
            optimizationContextId: result["optimizationContextId"] as? String,
            isEmptyVariant: rawIsEmptyVariant.map {
                CFGetTypeID($0) == CFBooleanGetTypeID() && $0.boolValue
            } ?? false
        )
    }
}
