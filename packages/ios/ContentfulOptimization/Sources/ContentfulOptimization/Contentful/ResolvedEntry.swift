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
///
/// Mirrors every `Entry`/`FlatResource` member that a raw resolved map can actually carry:
/// `id`, `localeCode`, `createdAt`, `updatedAt`, `fields` (via `getField`), and the `String`/`Int`
/// subscripts. Three `Entry` members have no counterpart here, by construction rather than
/// oversight:
/// - `type: ContentType?` — a full fetched content-type schema resource. The resolved map only
///   ever carries the content type's `id` (`sys.contentType.sys.id`, see `OptimizationEntryMapping`),
///   never the schema `ContentType` itself, and `ContentType` has no public initializer to
///   reconstruct one from that id alone.
/// - `currentlySelectedLocale: Locale` — a full locale object (code/name/fallback chain), which
///   the resolved map never carries and `Locale` has no public initializer to fabricate.
/// - `metadata: Metadata?` / `setLocale(withCode:)` — `Metadata` has no public initializer, so
///   the resolved map's `metadata.tags` can't be wrapped back into a real `Metadata` value, only
///   into a dict `getField("metadata")` can still read. `setLocale` mutates which locale a live
///   multi-locale decode reads `fields` from; a resolved map is already a single-locale snapshot
///   with no such state to mutate.
public struct ResolvedEntry {
    private let raw: [String: Any]

    public init(_ raw: [String: Any]) {
        self.raw = raw
    }

    private var sys: [String: Any]? {
        raw["sys"] as? [String: Any]
    }

    /// The entry `sys.id` — stable across a variant swap, so it's safe for navigation.
    public var id: String? {
        sys?["id"] as? String
    }

    /// Mirrors `Entry.localeCode` (via `FlatResource`) — the code of the locale this resolved
    /// variant's `fields` were read for. Absent on a raw CDA response fetched via `/sync` or the
    /// wildcard `locale=*` query, same as on `Entry` itself.
    public var localeCode: String? {
        sys?["locale"] as? String
    }

    /// Mirrors `Entry.createdAt`. `nil` if the resolved map never carried a `sys.createdAt` — a
    /// resolver-synthesized entry (e.g. a variant assembled without a full CDA round trip) may
    /// have no creation timestamp to report, same as `Entry.createdAt` returning `nil` for a
    /// resource `select()`-queried without `sys`.
    public var createdAt: Date? {
        (sys?["createdAt"] as? String).flatMap { ISO8601DateFormatter().date(from: $0) }
    }

    /// Mirrors `Entry.updatedAt`. See `createdAt` for why this can be `nil`.
    public var updatedAt: Date? {
        (sys?["updatedAt"] as? String).flatMap { ISO8601DateFormatter().date(from: $0) }
    }

    /// A field's resolved value, or nil if absent.
    public func getField<T>(_ name: String) -> T? {
        (raw["fields"] as? [String: Any])?[name] as? T
    }

    /// Mirrors `Entry`'s `String` convenience subscript, which reads directly from `fields`.
    public subscript(key: String) -> String? {
        getField(key)
    }

    /// Mirrors `Entry`'s `Int` convenience subscript, which reads directly from `fields`.
    public subscript(key: String) -> Int? {
        getField(key)
    }
}
