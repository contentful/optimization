import Contentful
import Foundation

/// Reused across `CTEntry`/`CDA` rather than allocated per call.
private let jsonEncoder = JSONEncoder()
private let jsonDecoder = JSONDecoder()
private let iso8601DateFormatter = ISO8601DateFormatter()

/// Encodes any `Encodable` value into `JSONValue` via a real `JSONEncoder` -> `JSONDecoder` round
/// trip, rather than a hand-assembled dictionary literal.
private func jsonValueEncoded(_ value: some Encodable) throws -> JSONValue {
    let data = try jsonEncoder.encode(value)
    return try jsonDecoder.decode(JSONValue.self, from: data)
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
    private let entry: CDA.Entry

    private init(_ entry: CDA.Entry) {
        self.entry = entry
    }

    /// The `init(any:fallback:)` default — every reader below treats an empty entry as "absent."
    static let empty = CTEntry(CDA.Entry(sys: nil, fields: [:], metadata: nil))

    public init(_ contentfulEntry: Contentful.Entry) {
        entry = CDA.Entry(contentfulEntry, ancestors: [])
    }

    init(json: String) throws {
        guard let data = json.data(using: .utf8) else {
            throw OptimizationError.configError("JSON string is not valid UTF-8")
        }
        entry = try jsonDecoder.decode(CDA.Entry.self, from: data)
    }

    /// `any` is caller-supplied and not guaranteed JSON-safe — logs and falls back to `fallback`
    /// (`.empty` by default) instead of throwing.
    init(any: Any, fallback: @autoclosure () -> CTEntry = .empty) {
        do {
            guard JSONSerialization.isValidJSONObject(any) else {
                throw OptimizationError.configError("Unsupported value of type \(Swift.type(of: any)) in CTEntry(any:)")
            }
            let data = try JSONSerialization.data(withJSONObject: any)
            entry = try jsonDecoder.decode(CDA.Entry.self, from: data)
        } catch {
            DiagnosticLogger.shared.warning("[CTEntry] Failed to parse entry: \(error.localizedDescription)")
            self = fallback()
        }
    }

    func toJSON() throws -> String {
        let data = try jsonEncoder.encode(entry)
        return String(decoding: data, as: UTF8.self)
    }

    /// For callers that still work in `[String: Any]` shape (e.g. the reference UIKit
    /// implementation, `OptimizedEntry`'s `[String: Any]` initializer).
    public func toDictionary(fallback: @autoclosure () -> [String: Any] = [:]) -> [String: Any] {
        guard let data = try? jsonEncoder.encode(entry),
              let object = try? JSONSerialization.jsonObject(with: data),
              let dictionary = object as? [String: Any]
        else { return fallback() }
        return dictionary
    }

    /// A field's resolved value, or nil if absent.
    ///
    /// Don't call this with `T` inferred as `Any`/`Any?` to check presence — `nil as? Any` always
    /// succeeds, so a missing field comes back `Optional(nil)`, not `nil`. Use `hasField` or a
    /// concrete `T` instead.
    public func getField<T>(_ name: String) -> T? {
        entry.fields[name]?.toFoundation() as? T
    }

    public func hasField(_ name: String) -> Bool {
        entry.fields[name] != nil
    }

    /// Stable across a variant swap, so it's safe for navigation.
    public var id: String? {
        entry.sys?.id
    }

    /// The Contentful content type ID used to distinguish baseline and variant entry shapes.
    public var contentTypeId: String? {
        entry.sys?.contentType?.sys.id
    }

    public var localeCode: String? {
        entry.sys?.locale
    }

    public var createdAt: Date? {
        entry.sys?.createdAt.flatMap { iso8601DateFormatter.date(from: $0) }
    }

    public var updatedAt: Date? {
        entry.sys?.updatedAt.flatMap { iso8601DateFormatter.date(from: $0) }
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

    enum Link {
        case entry(Entry)
        case asset(Asset)
        case stub(LinkStub)

        func encoded() throws -> JSONValue {
            switch self {
            case let .entry(entry): return try jsonValueEncoded(entry)
            case let .asset(asset): return try jsonValueEncoded(asset)
            case let .stub(stub): return try jsonValueEncoded(stub)
            }
        }

        /// `ancestors` is the set of entry ids on the path from the root to here — see
        /// `CDA.Entry.init(_:ancestors:)` for why a back-edge becomes `.stub` instead of recursing.
        init(_ link: Contentful.Link, ancestors: Set<String>) {
            switch link {
            case let .entry(entry) where !ancestors.contains(entry.id):
                self = .entry(Entry(entry, ancestors: ancestors))
            case let .asset(asset):
                self = .asset(Asset(asset))
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
        case link(Link)
        case richText(RichTextNode)
        case fileMetadata(FileMetadata)
        case location(Location)

        /// `nil` if unrepresentable — caller drops the field rather than losing the whole entry.
        func encoded() -> JSONValue? {
            switch self {
            case let .value(value): return value
            case let .link(link): return try? link.encoded()
            case let .richText(richText): return try? jsonValueEncoded(richText)
            case let .fileMetadata(fileMetadata): return try? jsonValueEncoded(fileMetadata)
            case let .location(location): return try? jsonValueEncoded(location)
            }
        }

        init(_ value: Any, ancestors: Set<String>) {
            switch value {
            case let link as Contentful.Link:
                self = .link(Link(link, ancestors: ancestors))
            case let richText as Contentful.RichTextDocument:
                self = .richText(RichTextNode(richText, ancestors: ancestors))
            // An "Object" field shaped like file metadata decodes to this type before falling
            // back to a plain dictionary.
            case let file as Contentful.Asset.FileMetadata:
                self = .fileMetadata(FileMetadata(file))
            case let array as [Any]:
                self = .value(.array(array.compactMap { Field($0, ancestors: ancestors).encoded() }))
            case let dictionary as [String: Any]:
                self = .value(.object(dictionary.compactMapValues { Field($0, ancestors: ancestors).encoded() }))
            case let location as Contentful.Location:
                self = .location(Location(location))
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
                contentType: sys.contentTypeId.map { .init(sys: .init(id: $0, type: "Link", linkType: "ContentType")) },
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
                tags: (entry.metadata?.tags ?? []).compactMap { try? Link($0, ancestors: childAncestors).encoded() },
                concepts: []
            )

            self.init(sys: sys, fields: fields, metadata: metadata)
        }
    }

    struct Metadata: Codable {
        let tags: [JSONValue]
        let concepts: [JSONValue]
    }

    struct Asset: Codable {
        let sys: AssetSys
        let fields: AssetFields

        struct AssetSys: Codable {
            let id: String
            let type: String
        }

        struct AssetFields: Codable {
            let title: String
            let description: String?
            let file: FileMetadata
        }

        init(_ asset: Contentful.Asset) {
            sys = .init(id: asset.id, type: "Asset")
            fields = .init(
                title: asset.title ?? "",
                description: asset.description,
                file: asset.file.map(FileMetadata.init) ?? FileMetadata(
                    fileName: nil, contentType: nil, details: nil, url: asset.urlString ?? ""
                )
            )
        }
    }

    struct FileMetadata: Codable {
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

    struct Location: Codable {
        let lat: Double
        let lon: Double

        init(_ location: Contentful.Location) {
            lat = location.latitude
            lon = location.longitude
        }
    }

    struct RichTextNode: Codable {
        let nodeType: String
        var value: String?
        var marks: [Mark]?
        var data: NodeData
        var content: [RichTextNode]?

        struct Mark: Codable { let type: String }

        struct NodeData: Codable {
            var uri: String?
            var target: JSONValue?

            init(uri: String? = nil, target: JSONValue? = nil) {
                self.uri = uri
                self.target = target
            }
        }

        init(nodeType: String, value: String? = nil, marks: [Mark]? = nil, data: NodeData = NodeData(), content: [RichTextNode]? = nil) {
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
                    data: .init(target: try? Link(resourceLink.data.target, ancestors: ancestors).encoded()),
                    content: resourceLink.content.map { RichTextNode($0, ancestors: ancestors) }
                )
            case let resourceLink as Contentful.ResourceLinkInline:
                self.init(
                    nodeType: resourceLink.nodeType.rawValue,
                    data: .init(target: try? Link(resourceLink.data.target, ancestors: ancestors).encoded()),
                    content: resourceLink.content.map { RichTextNode($0, ancestors: ancestors) }
                )
            case let hyperlink as Contentful.Hyperlink:
                self.init(
                    nodeType: hyperlink.nodeType.rawValue,
                    data: .init(uri: hyperlink.data.uri),
                    content: hyperlink.content.map { RichTextNode($0, ancestors: ancestors) }
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
                    content: recursive.content.map { RichTextNode($0, ancestors: ancestors) }
                )
            default:
                self.init(nodeType: node.nodeType.rawValue)
            }
        }
    }
}
