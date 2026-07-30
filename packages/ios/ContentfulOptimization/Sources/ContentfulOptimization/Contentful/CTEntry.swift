import Contentful
import Foundation

/// Both directions of the `Contentful.Entry <-> JSON` boundary `OptimizedEntry` and
/// `OptimizationClient.resolveOptimizedEntry` need, backed by `CDA.EntryEnvelope` — a typed
/// `{sys, fields, metadata}` contract — rather than a hand-built `[String: Any]` dictionary read
/// back with `as?` casts:
///
/// - **Encode**: `CTEntry(_: Contentful.Entry)` builds the `{sys, fields, metadata}` tree a
///   `Contentful.Entry` maps to, reconstructing the resolved-link JSON shape a raw CDA response
///   carried before the Delivery SDK decoded it. Every fixed-shape piece (`Sys`, a content-type
///   link, `Metadata`, a link stub, an asset envelope, a Structured Text node) is a small
///   `Codable` struct (`CDA`, below the type) with its own `static func from(...)` factory. A
///   field's own *value* (as opposed to the envelope's fixed shape) still goes through
///   `JSONValue` — `EntryEnvelope.fields` is `[String: JSONValue]`, since a field's runtime type
///   is only known once `CDA.Field.from` inspects it, not upfront like `sys`/`metadata`.
///   `toJSON()` serializes `envelope` directly via `JSONEncoder`.
/// - **Decode**: `init(any:)` wraps the resolver's already-parsed `[String: Any]` bridge output;
///   `init(json:)` decodes a raw JSON string. Both land on the same `CDA.EntryEnvelope`, whose
///   `init(from:)` decodes `sys`/`fields`/`metadata` independently (see the type for why) so a
///   caller's partial or malformed input loses only the missing/malformed piece, not the whole
///   entry. The reader surface below (`id`, `localeCode`, `createdAt`, `updatedAt`, `getField`)
///   mirrors `Contentful.Entry`'s own readable surface, so resolved content reads like a fetched
///   entry instead of a raw map dug through with `as?` casts.
///
/// Ported from the reference implementation's simulation of this exact gap:
/// `examples/apps/travel-guide-ios/Sources/OptimizationAdapter.swift`
/// (`Entry.optimizationMap` + `ResolvedEntry`).
///
/// `JSONValue.number` has no separate `Int` case — an `Int` field (`sys.revision`, an asset's
/// `file.details.size`, a plain integer field) round-trips as a `Double`. `getField<Int>`/`as? Int`
/// on such a field does not match; read it as `Double` (or `Int` via `Int(exactly:)` on the
/// `Double`) instead. Accepted for reuse of the package's one shared JSON AST rather than
/// introducing a second, `Int`-preserving JSON value type solely for this file.
///
/// An `Entry` can't be rebuilt from a resolved value — `Contentful.Entry.init(from:)` needs a
/// `LocalizationContext` in `decoder.userInfo` that only a live CDA decode carries. This type
/// shares the resolved *shape* with `Entry`, not the type, on purpose: the reader surface below is
/// as far as that mirroring can go. Three `Entry` members have no counterpart here, by
/// construction rather than oversight:
/// - `type: ContentType?` — a full fetched content-type schema resource. The resolved tree only
///   ever carries the content type's `id` (`sys.contentType.sys.id`), never the schema
///   `ContentType` itself, and `ContentType` has no public initializer to reconstruct one from
///   that id alone.
/// - `currentlySelectedLocale: Locale` — a full locale object (code/name/fallback chain), which
///   the resolved tree never carries and `Locale` has no public initializer to fabricate.
/// - `metadata: Metadata?` / `setLocale(withCode:)` — `Metadata` has no public initializer, so
///   the resolved tree's `metadata.tags` can't be wrapped back into a real `Metadata` value, only
///   read via `getField("metadata")`. `setLocale` mutates which locale a live multi-locale decode
///   reads `fields` from; a resolved tree is already a single-locale snapshot with no such state
///   to mutate.
public struct CTEntry {
    private let envelope: CDA.EntryEnvelope

    private init(_ envelope: CDA.EntryEnvelope) {
        self.envelope = envelope
    }

    // MARK: - Parsing

    /// Decodes a raw JSON string directly into `CDA.EntryEnvelope` — no separate `JSONValue`
    /// parse step, since the envelope's own tolerant `init(from:)` (see the type) already handles
    /// a partial or malformed tree without throwing.
    init(json: String) throws {
        guard let data = json.data(using: .utf8) else {
            throw OptimizationError.configError("JSON string is not valid UTF-8")
        }
        envelope = try JSONDecoder().decode(CDA.EntryEnvelope.self, from: data)
    }

    /// Wraps an already-decoded `Any` value (e.g. `JSONSerialization`'s output, or a hand-built
    /// `[String: Any]` at a call site that hasn't adopted this type). Guarded by
    /// `isValidJSONObject` first — calling `JSONSerialization.data(withJSONObject:)` on a value
    /// it can't serialize (e.g. `Date`) raises an uncaught `NSException`, not a catchable `Error`,
    /// so that check has to happen before the call, not around it. Once validated, the value is
    /// JSON-encoded and decoded into `CDA.EntryEnvelope`, whose own tolerant `init(from:)` (see
    /// the type) degrades a merely wrong-shaped-for-an-entry tree to `nil` fields rather than
    /// throwing.
    init(any: Any) throws {
        guard JSONSerialization.isValidJSONObject(any) else {
            throw OptimizationError.configError("Unsupported value of type \(Swift.type(of: any)) in CTEntry(any:)")
        }
        let data = try JSONSerialization.data(withJSONObject: any)
        envelope = try JSONDecoder().decode(CDA.EntryEnvelope.self, from: data)
    }

    // MARK: - Serializing

    /// `JSONEncoder`'s output is always valid UTF-8 by spec, so `String(decoding:as:)` — which
    /// never fails — is correct here; `String(data:encoding:.utf8)`'s optional would just be
    /// unreachable dead code on this input.
    func toJSON() throws -> String {
        let data = try JSONEncoder().encode(envelope)
        return String(decoding: data, as: UTF8.self)
    }

    /// The Foundation type (`[String: Any]`) call sites still on `[String: Any]`
    /// (`OptimizedEntry`'s dict-based initializer, `resolveOptimizedEntry(baseline: [String: Any])`)
    /// expect. Round-trips through `JSONEncoder`/`JSONSerialization` rather than hand-assembling
    /// the dict from `envelope`'s typed properties.
    func toFoundation() -> Any {
        guard let data = try? JSONEncoder().encode(envelope) else { return [String: Any]() }
        return (try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])) ?? [String: Any]()
    }

    // MARK: - Reading a resolved entry

    /// The entry `sys.id` — stable across a variant swap, so it's safe for navigation.
    public var id: String? {
        envelope.sys?.id
    }

    /// Mirrors `Entry.localeCode` (via `FlatResource`) — the code of the locale this resolved
    /// variant's `fields` were read for. Absent on a raw CDA response fetched via `/sync` or the
    /// wildcard `locale=*` query, same as on `Entry` itself.
    public var localeCode: String? {
        envelope.sys?.locale
    }

    /// Mirrors `Entry.createdAt`. `nil` if the resolved tree never carried a `sys.createdAt` — a
    /// resolver-synthesized entry (e.g. a variant assembled without a full CDA round trip) may
    /// have no creation timestamp to report, same as `Entry.createdAt` returning `nil` for a
    /// resource `select()`-queried without `sys`.
    public var createdAt: Date? {
        envelope.sys?.createdAt.flatMap { ISO8601DateFormatter().date(from: $0) }
    }

    /// Mirrors `Entry.updatedAt`. See `createdAt` for why this can be `nil`.
    public var updatedAt: Date? {
        envelope.sys?.updatedAt.flatMap { ISO8601DateFormatter().date(from: $0) }
    }

    /// A field's resolved value, or nil if absent.
    ///
    /// Do not call this with `T` inferred as `Any` (or `Any?`) to check presence — `nil as? Any`
    /// always succeeds, so a missing field comes back as a non-nil `Optional(nil)` rather than
    /// `nil`. Check presence via `toFoundation()` instead, or infer a concrete `T`.
    public func getField<T>(_ name: String) -> T? {
        envelope.fields[name]?.toFoundation() as? T
    }

    /// Mirrors `Entry`'s `String` convenience subscript, which reads directly from `fields`.
    public subscript(field key: String) -> String? {
        getField(key)
    }

    // MARK: - Encoding a `Contentful.Entry`

    /// Encodes a `contentful.swift` `Entry` into the `{sys, fields, metadata}` envelope
    /// `OptimizedEntry`/`resolveOptimizedEntry` expect.
    public init(_ entry: Contentful.Entry) {
        envelope = CDA.EntryEnvelope.from(entry, ancestors: [])
    }
}

// MARK: - Codable envelopes for the raw CDA response shapes

/// Small `Codable` structs mirroring the fixed parts of a raw CDA response — `sys`, a
/// content-type link, `metadata`, an unresolved-link stub, an asset, a Structured Text node. Each
/// has a `static func from(...)` factory building it from the corresponding `contentful.swift`
/// type, and converts to `JSONValue` via `JSONValue.encoded(_:)` (a real `JSONEncoder` round trip
/// through `JSONValue`'s own `Codable` conformance) — never a hand-assembled dictionary literal.
private enum CDA {
    /// The `{sys: {id, type: "Link", linkType}}` shape a back-edge or an unresolved link has in a
    /// raw CDA response — the one stub shape every unresolved case (`Link.unresolved`, a back-edge
    /// entry, an untyped `EntryDecodable`) emits.
    struct LinkStub: Codable {
        let sys: Sys
        struct Sys: Codable {
            let id: String
            let type: String
            let linkType: String
        }

        init(id: String, linkType: String) {
            sys = Sys(id: id, type: "Link", linkType: linkType)
        }
    }

    /// A link field's resolved value, one step before it becomes `JSONValue` — every case still
    /// holds its own `Codable` envelope, encoded on demand via `encoded()`.
    enum LinkValue {
        case entry(EntryEnvelope)
        case asset(AssetEnvelope)
        case stub(LinkStub)

        func encoded() throws -> JSONValue {
            switch self {
            case let .entry(envelope): return try JSONValue.encoded(envelope)
            case let .asset(envelope): return try JSONValue.encoded(envelope)
            case let .stub(envelope): return try JSONValue.encoded(envelope)
            }
        }

        /// A link field, expanded into the linked resource when the Delivery SDK resolved it.
        /// `ancestors` is the set of entry ids on the path from the root to here — see
        /// `EntryEnvelope.from` for why a back-edge becomes `.stub` instead of recursing.
        static func from(_ link: Contentful.Link, ancestors: Set<String>) -> LinkValue {
            switch link {
            case let .entry(entry) where !ancestors.contains(entry.id):
                return .entry(.from(entry, ancestors: ancestors))
            case let .asset(asset):
                return .asset(.from(asset))
            case let .unresolved(sys):
                return .stub(.init(id: sys.id, linkType: sys.linkType))
            // A back-edge, or a typed `EntryDecodable` this mapper never registers: emit the
            // stub an unresolved link has in a raw CDA response.
            case .entry, .entryDecodable:
                return .stub(.init(id: link.id, linkType: "Entry"))
            }
        }
    }

    /// One field value's resolved shape, one step before it becomes `JSONValue` — mirrors
    /// `LinkValue` above: `Field.from` dispatches on the field's runtime type into one of these
    /// cases with a plain type-checked `switch`; whether that particular value can actually
    /// become `JSONValue` (a non-finite `Double` is the only failure mode anywhere in this tree)
    /// is decided once, in `encoded()`, not per case at the dispatch site.
    enum Field {
        /// A leaf or already-recursed container `JSONValue` — `nil` for a value `from` has no
        /// case for (dropped, per the type's documented "lose the field, not the entry" policy)
        /// or a non-finite `Double`/`Location` coordinate.
        case value(JSONValue?)
        case link(LinkValue)
        case richText(RichTextNodeEnvelope)
        case fileMetadata(FileMetadataEnvelope)
        case location(LocationEnvelope)

        /// `nil` if this value can't become `JSONValue` — a `.value(nil)` case, or a `Codable`
        /// envelope whose encode failed on a non-finite `Double`. Every caller drops the field on
        /// `nil` rather than losing the whole entry.
        func encoded() -> JSONValue? {
            switch self {
            case let .value(value): return value
            case let .link(linkValue): return try? linkValue.encoded()
            case let .richText(envelope): return try? JSONValue.encoded(envelope)
            case let .fileMetadata(envelope): return try? JSONValue.encoded(envelope)
            case let .location(envelope): return try? JSONValue.encoded(envelope)
            }
        }

        /// One field value, reduced to something the bridge accepts — the resolver serializes
        /// the whole tree before handing it to its JS bridge, and one illegal value fails the
        /// entry outright (it falls back to baseline, logging rather than throwing). Anything
        /// not listed here is dropped rather than risking that: losing an unused field beats
        /// losing personalization on the entry that holds it.
        static func from(_ value: Any, ancestors: Set<String>) -> Field {
            switch value {
            case let link as Contentful.Link:
                return .link(.from(link, ancestors: ancestors))
            case let richText as Contentful.RichTextDocument:
                return .richText(.from(richText, ancestors: ancestors))
            // A field of Contentful type "Object" shaped exactly like a file metadata blob
            // (`{fileName, contentType, url, details: {size, image: {width, height}}}`) decodes
            // to this type — the generic `[String: Any]` decoder (`Decodable.swift`) tries it
            // before falling back to a plain dictionary. Reuses `FileMetadataEnvelope.from`, the
            // same factory a resolved asset link's `file` field goes through.
            case let file as Contentful.Asset.FileMetadata:
                return .fileMetadata(.from(file))
            case let array as [Any]:
                return .value(.array(array.compactMap { from($0, ancestors: ancestors).encoded() }))
            case let dictionary as [String: Any]:
                return .value(.object(dictionary.compactMapValues { from($0, ancestors: ancestors).encoded() }))
            case let location as Contentful.Location:
                return .location(.from(location))
            case let date as Date:
                return .value(.string(ISO8601DateFormatter().string(from: date)))
            case let string as String:
                return .value(.string(string))
            case let int as Int:
                return .value(.number(Double(int)))
            case let double as Double:
                return .value(double.isFinite ? .number(double) : nil)
            case let bool as Bool:
                return .value(.bool(bool))
            default:
                return .value(nil)
            }
        }
    }

    /// `id`/`locale`/`createdAt`/`updatedAt` are all plain optional properties decoded
    /// independently via `try?` (see `init(from:)`) rather than a synthesized `Codable`
    /// conformance: a synthesized decoder throws — failing the *entire* `Sys`, and by extension
    /// the entry that holds it — the moment any one key is absent or the wrong type (e.g.
    /// `sys.id` being a number instead of a string). A caller-supplied baseline is not guaranteed
    /// well-formed (see `CTEntry.init(any:)`), so a per-field `try?` degrades exactly the
    /// offending key to `nil` and leaves the rest of `Sys` — and every other entry field —
    /// intact, matching this type's "lose a field, not the entry" policy.
    struct Sys: Codable {
        let id: String?
        let type: String?
        let contentType: ContentTypeLink?
        let createdAt: String?
        let updatedAt: String?
        let revision: Int?
        let locale: String?

        struct ContentTypeLink: Codable {
            let sys: LinkStub.Sys
        }

        private enum CodingKeys: String, CodingKey {
            case id, type, contentType, createdAt, updatedAt, revision, locale
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try? container.decode(String.self, forKey: .id)
            type = try? container.decode(String.self, forKey: .type)
            contentType = try? container.decode(ContentTypeLink.self, forKey: .contentType)
            createdAt = try? container.decode(String.self, forKey: .createdAt)
            updatedAt = try? container.decode(String.self, forKey: .updatedAt)
            revision = try? container.decode(Int.self, forKey: .revision)
            locale = try? container.decode(String.self, forKey: .locale)
        }

        init(id: String?, type: String?, contentType: ContentTypeLink?, createdAt: String?, updatedAt: String?, revision: Int?, locale: String?) {
            self.id = id
            self.type = type
            self.contentType = contentType
            self.createdAt = createdAt
            self.updatedAt = updatedAt
            self.revision = revision
            self.locale = locale
        }

        /// All of `createdAt`/`updatedAt`/`revision`/`locale` are independently optional on
        /// `Contentful.Sys` itself (e.g. `locale` is absent on a `/sync` or wildcard-locale
        /// response); `Codable`'s default `encodeIfPresent` behavior for `nil` optionals then
        /// omits the key, matching the raw CDA response shape rather than emitting null.
        static func from(_ sys: Contentful.Sys) -> Sys {
            Sys(
                id: sys.id,
                type: "Entry",
                contentType: .init(sys: .init(id: sys.contentTypeId ?? "", type: "Link", linkType: "ContentType")),
                createdAt: sys.createdAt.map { ISO8601DateFormatter().string(from: $0) },
                updatedAt: sys.updatedAt.map { ISO8601DateFormatter().string(from: $0) },
                revision: sys.revision,
                locale: sys.locale
            )
        }
    }

    /// `sys`/`fields`/`metadata` decode independently via `try?`, for the same reason `Sys`'s own
    /// properties do: a caller-supplied baseline can be missing any of them (see
    /// `CTEntry.init(any:)`/`init(json:)`), and losing the whole entry to one absent or
    /// wrong-shaped top-level key would be worse than reading that piece back as `nil`/empty.
    struct EntryEnvelope: Codable {
        let sys: Sys?
        let fields: [String: JSONValue]
        let metadata: Metadata?

        private enum CodingKeys: String, CodingKey {
            case sys, fields, metadata
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            sys = try? container.decode(Sys.self, forKey: .sys)
            fields = (try? container.decode([String: JSONValue].self, forKey: .fields)) ?? [:]
            metadata = try? container.decode(Metadata.self, forKey: .metadata)
        }

        init(sys: Sys?, fields: [String: JSONValue], metadata: Metadata?) {
            self.sys = sys
            self.fields = fields
            self.metadata = metadata
        }

        /// `ancestors` is the set of entry ids on the path from the root to here. The Delivery
        /// SDK resolves links into shared object references, so a variant that links back to
        /// its baseline is a real cycle in the object graph; recursing an entry already on the
        /// current path would loop forever. Re-linking an ancestor emits an unresolved link stub
        /// instead — the shape a back-edge has in a raw CDA response. Scoping to the current
        /// path (not a global visited set) still expands diamonds: an entry reached by two
        /// sibling branches expands fully in both.
        static func from(_ entry: Contentful.Entry, ancestors: Set<String>) -> EntryEnvelope {
            let childAncestors = ancestors.union([entry.id])

            let sys = Sys.from(entry.sys)
            let fields = entry.fields.compactMapValues { Field.from($0, ancestors: childAncestors).encoded() }

            // Required, not cosmetic: the resolver's entry guard rejects any entry without a
            // `metadata` object, and a rejected baseline is never given its variant. A raw CDA
            // response carries it on every entry; `Entry` keeps it out of `fields`, so this has
            // to put it back. `concepts` is always empty — `contentful.swift`'s `Metadata`
            // models only `tags`, so the SDK gives us nothing else to forward.
            let metadata = Metadata(
                tags: (entry.metadata?.tags ?? []).compactMap { try? LinkValue.from($0, ancestors: childAncestors).encoded() },
                concepts: []
            )

            return EntryEnvelope(sys: sys, fields: fields, metadata: metadata)
        }
    }

    struct Metadata: Codable {
        let tags: [JSONValue]
        let concepts: [JSONValue]
    }

    struct AssetEnvelope: Codable {
        let sys: AssetSys
        let fields: AssetFields

        struct AssetSys: Codable {
            let id: String
            let type: String
        }

        struct AssetFields: Codable {
            let title: String
            let description: String?
            let file: FileMetadataEnvelope
        }

        static func from(_ asset: Contentful.Asset) -> AssetEnvelope {
            AssetEnvelope(
                sys: .init(id: asset.id, type: "Asset"),
                fields: .init(
                    title: asset.title ?? "",
                    description: asset.description,
                    file: asset.file.map(FileMetadataEnvelope.from) ?? FileMetadataEnvelope(
                        fileName: nil, contentType: nil, details: nil, url: asset.urlString ?? ""
                    )
                )
            )
        }
    }

    /// An asset's `file` metadata, reduced to the raw CDA response shape
    /// (`{fileName, contentType, details: {size, image: {width, height}}, url}`) — the same shape
    /// whether it arrived via a resolved asset link (`AssetEnvelope.from`) or as a directly
    /// decoded field value (`jsonValue`'s `Asset.FileMetadata` case). `details.image` is only
    /// present for image files.
    struct FileMetadataEnvelope: Codable {
        let fileName: String?
        let contentType: String?
        let details: Details?
        let url: String

        struct Details: Codable {
            let size: Int
            let image: ImageInfo?

            struct ImageInfo: Codable {
                let width: Double
                let height: Double
            }
        }

        static func from(_ file: Contentful.Asset.FileMetadata) -> FileMetadataEnvelope {
            FileMetadataEnvelope(
                fileName: file.fileName,
                contentType: file.contentType,
                details: .init(
                    size: file.details?.size ?? 0,
                    image: file.details?.imageInfo.map { .init(width: $0.width, height: $0.height) }
                ),
                url: file.url?.absoluteString ?? ""
            )
        }
    }

    /// A `Location` field, reduced to the raw CDA response shape (`{lat, lon}`).
    struct LocationEnvelope: Codable {
        let lat: Double
        let lon: Double

        static func from(_ location: Contentful.Location) -> LocationEnvelope {
            LocationEnvelope(lat: location.latitude, lon: location.longitude)
        }
    }

    /// One Structured Text node, reduced to the same `{nodeType, data, content}` shape a raw CDA
    /// response carries.
    struct RichTextNodeEnvelope: Codable {
        let nodeType: String
        var value: String?
        var marks: [Mark]?
        var data: NodeData
        var content: [RichTextNodeEnvelope]?

        struct Mark: Codable { let type: String }

        struct NodeData: Codable {
            var uri: String?
            var target: JSONValue?

            init(uri: String? = nil, target: JSONValue? = nil) {
                self.uri = uri
                self.target = target
            }
        }

        init(nodeType: String, value: String? = nil, marks: [Mark]? = nil, data: NodeData = NodeData(), content: [RichTextNodeEnvelope]? = nil) {
            self.nodeType = nodeType
            self.value = value
            self.marks = marks
            self.data = data
            self.content = content
        }

        /// `ResourceLinkBlock`/`ResourceLinkInline` (embedded entries and assets — both `-block`
        /// and `-inline` variants share these two Swift types across all five
        /// `embedded-*`/`*-hyperlink` node types) must be matched before the generic
        /// `RecursiveNode` case, since both conform to it; falling through to the generic case
        /// would silently drop the embedded resource's resolved-or-unresolved link entirely;
        /// ordering matters here.
        static func from(_ node: Contentful.Node, ancestors: Set<String>) -> RichTextNodeEnvelope {
            switch node {
            case let resourceLink as Contentful.ResourceLinkBlock:
                return RichTextNodeEnvelope(
                    nodeType: resourceLink.nodeType.rawValue,
                    data: .init(target: try? LinkValue.from(resourceLink.data.target, ancestors: ancestors).encoded()),
                    content: resourceLink.content.map { from($0, ancestors: ancestors) }
                )
            case let resourceLink as Contentful.ResourceLinkInline:
                return RichTextNodeEnvelope(
                    nodeType: resourceLink.nodeType.rawValue,
                    data: .init(target: try? LinkValue.from(resourceLink.data.target, ancestors: ancestors).encoded()),
                    content: resourceLink.content.map { from($0, ancestors: ancestors) }
                )
            case let hyperlink as Contentful.Hyperlink:
                return RichTextNodeEnvelope(
                    nodeType: hyperlink.nodeType.rawValue,
                    data: .init(uri: hyperlink.data.uri),
                    content: hyperlink.content.map { from($0, ancestors: ancestors) }
                )
            case let text as Contentful.Text:
                return RichTextNodeEnvelope(
                    nodeType: text.nodeType.rawValue,
                    value: text.value,
                    marks: text.marks.map { .init(type: $0.type.rawValue) }
                )
            // Table/TableRow/TableRowHeaderCell/TableRowCell/Paragraph/Heading/BlockQuote/
            // HorizontalRule/OrderedList/UnorderedList/ListItem, and the top-level
            // RichTextDocument itself — all plain containers with no data beyond their children.
            case let recursive as Contentful.RecursiveNode:
                return RichTextNodeEnvelope(
                    nodeType: recursive.nodeType.rawValue,
                    content: recursive.content.map { from($0, ancestors: ancestors) }
                )
            default:
                return RichTextNodeEnvelope(nodeType: node.nodeType.rawValue)
            }
        }
    }
}
