import Contentful
import Foundation

/// Reused across `CTEntry`/`CDA` rather than allocated per call.
private let jsonEncoder = JSONEncoder()
private let jsonDecoder = JSONDecoder()
private let iso8601DateFormatter = ISO8601DateFormatter()

private extension JSONValue {
    /// Encodes any `Encodable` value into `JSONValue` via a real `JSONEncoder` -> `JSONDecoder`
    /// round trip, rather than a hand-assembled dictionary literal.
    static func encoded(_ value: some Encodable) throws -> JSONValue {
        let data = try jsonEncoder.encode(value)
        return try jsonDecoder.decode(JSONValue.self, from: data)
    }
}

/// Bridges `Contentful.Entry` and the resolver's raw JSON (`{sys, fields, metadata}`).
/// `init(_:Contentful.Entry)`/`toJSON()` encode; `init(any:)`/`init(json:)` decode.
///
/// Shares the resolved *shape* with `Entry`, not the type: `type`, `currentlySelectedLocale`,
/// `metadata`, and `setLocale(withCode:)` have no counterpart here, since each needs a resource
/// (`ContentType`, `Locale`, `Metadata`) with no public initializer to fabricate from the resolved
/// tree alone.
///
/// `JSONValue.number` has no `Int` case, so an `Int` field round-trips as `Double` —
/// `getField<Int>` won't match it.
public struct CTEntry {
    private let envelope: CDA.Entry

    private init(_ envelope: CDA.Entry) {
        self.envelope = envelope
    }

    /// The `parseWithFallback` default — every reader below treats an empty envelope as "absent."
    static let empty = CTEntry(CDA.Entry(sys: nil, fields: [:], metadata: nil))

    public init(_ entry: Contentful.Entry) {
        envelope = CDA.Entry(entry, ancestors: [])
    }

    init(json: String) throws {
        guard let data = json.data(using: .utf8) else {
            throw OptimizationError.configError("JSON string is not valid UTF-8")
        }
        envelope = try jsonDecoder.decode(CDA.Entry.self, from: data)
    }

    init(any: Any) throws {
        guard JSONSerialization.isValidJSONObject(any) else {
            throw OptimizationError.configError("Unsupported value of type \(Swift.type(of: any)) in CTEntry(any:)")
        }
        let data = try JSONSerialization.data(withJSONObject: any)
        envelope = try jsonDecoder.decode(CDA.Entry.self, from: data)
    }

    /// `init(any:)` without a `throws` path — logs and returns `fallback` instead.
    static func parseWithFallback(_ any: Any, fallback: @autoclosure () -> CTEntry = .empty) -> CTEntry {
        do {
            return try CTEntry(any: any)
        } catch {
            DiagnosticLogger.shared.warning("[CTEntry] Failed to parse entry: \(error.localizedDescription)")
            return fallback()
        }
    }

    func toJSON() throws -> String {
        let data = try jsonEncoder.encode(envelope)
        return String(decoding: data, as: UTF8.self)
    }

    func toFoundation() -> Any {
        guard let data = try? jsonEncoder.encode(envelope) else { return [String: Any]() }
        return (try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])) ?? [String: Any]()
    }

    /// `toFoundation()`, narrowed to `[String: Any]` for callers that still work in that shape
    /// (e.g. the reference UIKit implementation, `OptimizedEntry`'s `[String: Any]` initializer).
    public func toDictionary(fallback: @autoclosure () -> [String: Any] = [:]) -> [String: Any] {
        toFoundation() as? [String: Any] ?? fallback()
    }

    /// A field's resolved value, or nil if absent.
    ///
    /// Don't call this with `T` inferred as `Any`/`Any?` to check presence — `nil as? Any` always
    /// succeeds, so a missing field comes back `Optional(nil)`, not `nil`. Use `hasField` or a
    /// concrete `T` instead.
    public func getField<T>(_ name: String) -> T? {
        envelope.fields[name]?.toFoundation() as? T
    }

    public func hasField(_ name: String) -> Bool {
        envelope.fields[name] != nil
    }

    /// Stable across a variant swap, so it's safe for navigation.
    public var id: String? {
        envelope.sys?.id
    }

    public var localeCode: String? {
        envelope.sys?.locale
    }

    public var createdAt: Date? {
        envelope.sys?.createdAt.flatMap { iso8601DateFormatter.date(from: $0) }
    }

    public var updatedAt: Date? {
        envelope.sys?.updatedAt.flatMap { iso8601DateFormatter.date(from: $0) }
    }

    public subscript(field key: String) -> String? {
        getField(key)
    }
}

/// Codable structs mirroring the fixed parts of a raw CDA response.
private enum CDA {
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

    enum LinkValue {
        case entry(Entry)
        case asset(AssetEnvelope)
        case stub(LinkStub)

        func encoded() throws -> JSONValue {
            switch self {
            case let .entry(envelope): return try JSONValue.encoded(envelope)
            case let .asset(envelope): return try JSONValue.encoded(envelope)
            case let .stub(envelope): return try JSONValue.encoded(envelope)
            }
        }

        /// `ancestors` is the set of entry ids on the path from the root to here — see
        /// `CDA.Entry.init(_:ancestors:)` for why a back-edge becomes `.stub` instead of recursing.
        init(_ link: Contentful.Link, ancestors: Set<String>) {
            switch link {
            case let .entry(entry) where !ancestors.contains(entry.id):
                self = .entry(Entry(entry, ancestors: ancestors))
            case let .asset(asset):
                self = .asset(AssetEnvelope(asset))
            case let .unresolved(sys):
                self = .stub(.init(id: sys.id, linkType: sys.linkType))
            // A back-edge, or a typed `EntryDecodable` this mapper never registers: emit the
            // stub an unresolved link has in a raw CDA response.
            case .entry, .entryDecodable:
                self = .stub(.init(id: link.id, linkType: "Entry"))
            }
        }
    }

    enum Field {
        case value(JSONValue?)
        case link(LinkValue)
        case richText(RichTextNodeEnvelope)
        case fileMetadata(FileMetadataEnvelope)
        case location(LocationEnvelope)

        /// `nil` if unrepresentable — caller drops the field rather than losing the whole entry.
        func encoded() -> JSONValue? {
            switch self {
            case let .value(value): return value
            case let .link(linkValue): return try? linkValue.encoded()
            case let .richText(envelope): return try? JSONValue.encoded(envelope)
            case let .fileMetadata(envelope): return try? JSONValue.encoded(envelope)
            case let .location(envelope): return try? JSONValue.encoded(envelope)
            }
        }

        init(_ value: Any, ancestors: Set<String>) {
            switch value {
            case let link as Contentful.Link:
                self = .link(LinkValue(link, ancestors: ancestors))
            case let richText as Contentful.RichTextDocument:
                self = .richText(RichTextNodeEnvelope(richText, ancestors: ancestors))
            // An "Object" field shaped like file metadata decodes to this type before falling
            // back to a plain dictionary.
            case let file as Contentful.Asset.FileMetadata:
                self = .fileMetadata(FileMetadataEnvelope(file))
            case let array as [Any]:
                self = .value(.array(array.compactMap { Field($0, ancestors: ancestors).encoded() }))
            case let dictionary as [String: Any]:
                self = .value(.object(dictionary.compactMapValues { Field($0, ancestors: ancestors).encoded() }))
            case let location as Contentful.Location:
                self = .location(LocationEnvelope(location))
            case let date as Date:
                self = .value(.string(iso8601DateFormatter.string(from: date)))
            case let string as String:
                self = .value(.string(string))
            case let int as Int:
                self = .value(.number(Double(int)))
            case let double as Double:
                self = .value(double.isFinite ? .number(double) : nil)
            case let bool as Bool:
                self = .value(.bool(bool))
            default:
                self = .value(nil)
            }
        }
    }

    /// Properties decode independently via `try?`: a synthesized decoder would fail all of `Sys`
    /// the moment one key is absent or the wrong type, but a caller-supplied baseline isn't
    /// guaranteed well-formed.
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

        init(_ sys: Contentful.Sys) {
            self.init(
                id: sys.id,
                type: "Entry",
                contentType: .init(sys: .init(id: sys.contentTypeId ?? "", type: "Link", linkType: "ContentType")),
                createdAt: sys.createdAt.map { iso8601DateFormatter.string(from: $0) },
                updatedAt: sys.updatedAt.map { iso8601DateFormatter.string(from: $0) },
                revision: sys.revision,
                locale: sys.locale
            )
        }
    }

    /// Same per-field `try?` reasoning as `Sys`.
    struct Entry: Codable {
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

        /// `ancestors` is the path from root to here — a variant linking back to its baseline is a
        /// real cycle, so a re-linked ancestor emits an unresolved link stub instead of recursing
        /// forever. Scoped to the current path (not a global visited set) so diamonds still expand
        /// fully on both branches.
        init(_ entry: Contentful.Entry, ancestors: Set<String>) {
            let childAncestors = ancestors.union([entry.id])

            let sys = Sys(entry.sys)
            let fields = entry.fields.compactMapValues { Field($0, ancestors: childAncestors).encoded() }

            // The resolver's entry guard rejects any entry without a `metadata` object.
            let metadata = Metadata(
                tags: (entry.metadata?.tags ?? []).compactMap { try? LinkValue($0, ancestors: childAncestors).encoded() },
                concepts: []
            )

            self.init(sys: sys, fields: fields, metadata: metadata)
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

        init(_ asset: Contentful.Asset) {
            sys = .init(id: asset.id, type: "Asset")
            fields = .init(
                title: asset.title ?? "",
                description: asset.description,
                file: asset.file.map(FileMetadataEnvelope.init) ?? FileMetadataEnvelope(
                    fileName: nil, contentType: nil, details: nil, url: asset.urlString ?? ""
                )
            )
        }
    }

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

        init(fileName: String?, contentType: String?, details: Details?, url: String) {
            self.fileName = fileName
            self.contentType = contentType
            self.details = details
            self.url = url
        }

        init(_ file: Contentful.Asset.FileMetadata) {
            self.init(
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

    struct LocationEnvelope: Codable {
        let lat: Double
        let lon: Double

        init(_ location: Contentful.Location) {
            lat = location.latitude
            lon = location.longitude
        }
    }

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

        /// `ResourceLinkBlock`/`ResourceLinkInline` must be matched before the generic
        /// `RecursiveNode` case, since both conform to it — falling through would silently drop
        /// the embedded resource's link entirely.
        init(_ node: Contentful.Node, ancestors: Set<String>) {
            switch node {
            case let resourceLink as Contentful.ResourceLinkBlock:
                self.init(
                    nodeType: resourceLink.nodeType.rawValue,
                    data: .init(target: try? LinkValue(resourceLink.data.target, ancestors: ancestors).encoded()),
                    content: resourceLink.content.map { RichTextNodeEnvelope($0, ancestors: ancestors) }
                )
            case let resourceLink as Contentful.ResourceLinkInline:
                self.init(
                    nodeType: resourceLink.nodeType.rawValue,
                    data: .init(target: try? LinkValue(resourceLink.data.target, ancestors: ancestors).encoded()),
                    content: resourceLink.content.map { RichTextNodeEnvelope($0, ancestors: ancestors) }
                )
            case let hyperlink as Contentful.Hyperlink:
                self.init(
                    nodeType: hyperlink.nodeType.rawValue,
                    data: .init(uri: hyperlink.data.uri),
                    content: hyperlink.content.map { RichTextNodeEnvelope($0, ancestors: ancestors) }
                )
            case let text as Contentful.Text:
                self.init(
                    nodeType: text.nodeType.rawValue,
                    value: text.value,
                    marks: text.marks.map { .init(type: $0.type.rawValue) }
                )
            // Every other container node (tables, lists, headings, the document root, etc.)
            // conforms to RecursiveNode with no data beyond its children.
            case let recursive as Contentful.RecursiveNode:
                self.init(
                    nodeType: recursive.nodeType.rawValue,
                    content: recursive.content.map { RichTextNodeEnvelope($0, ancestors: ancestors) }
                )
            default:
                self.init(nodeType: node.nodeType.rawValue)
            }
        }
    }
}
