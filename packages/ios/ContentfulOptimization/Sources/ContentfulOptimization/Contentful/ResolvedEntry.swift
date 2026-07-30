import Foundation

/// The resolver's output read through the surface a fetched `Contentful.Entry` already has —
/// `getField` mirrors `ContentfulClient.getField`. A resolved variant reads like a fetched entry
/// instead of a raw `{sys, fields}` map to dig through by hand with `as?` casts.
///
/// Ported from the reference implementation's showcase of this gap:
/// `examples/apps/travel-guide-ios/Sources/OptimizationAdapter.swift` (`ResolvedEntry`).
///
/// Only the resolver side needs this — a fetched `Contentful.Entry` is already read this way. The
/// two can't share a type: an `Entry` can't be rebuilt from the resolver's map, since its
/// initializer needs a localization context only a live decode carries. They share the *shape*,
/// not the type, so app code reads both the same way without one impersonating the other.
public struct ResolvedEntry {
    private let raw: [String: Any]

    public init(_ raw: [String: Any]) {
        self.raw = raw
    }

    /// The entry `sys.id` — stable across a variant swap, so it's safe for navigation.
    public var id: String? {
        (raw["sys"] as? [String: Any])?["id"] as? String
    }

    /// A field's resolved value, or nil if absent.
    public func getField<T>(_ name: String) -> T? {
        (raw["fields"] as? [String: Any])?[name] as? T
    }
}
