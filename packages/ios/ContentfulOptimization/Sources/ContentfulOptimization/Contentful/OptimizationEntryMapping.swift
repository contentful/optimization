import Contentful
import Foundation

/// Maps a `contentful.swift` `Entry` into the `{sys, fields, metadata}` map
/// `OptimizedEntry` expects, reconstructing the resolved-link JSON shape the raw CDA response
/// carried before the Delivery SDK decoded it.
///
/// Ported from the reference implementation's in-app simulation of this exact gap:
/// `examples/apps/travel-guide-ios/Sources/OptimizationAdapter.swift` (`Entry.optimizationMap`).
enum OptimizationEntryMapping {
    static func toOptimizationEntry(_ entry: Contentful.Entry) -> [String: Any] {
        entryMap(entry, ancestors: [])
    }

    /// `ancestors` is the set of entry ids on the path from the root to here. The Delivery SDK
    /// resolves links into shared object references, so a variant that links back to its
    /// baseline is a real cycle in the object graph; recursing an entry already on the current
    /// path would loop forever. Re-linking an ancestor emits an unresolved link stub instead —
    /// the shape a back-edge has in a raw CDA response. Scoping to the current path (not a
    /// global visited set) still expands diamonds: an entry reached by two sibling branches
    /// expands fully in both.
    private static func entryMap(_ entry: Contentful.Entry, ancestors: Set<String>) -> [String: Any] {
        let childAncestors = ancestors.union([entry.id])

        var sys: [String: Any] = [
            "id": entry.id,
            "type": "Entry",
            "contentType": [
                "sys": ["id": entry.sys.contentTypeId ?? "", "type": "Link", "linkType": "ContentType"],
            ],
        ]
        // Carried through so `ResolvedEntry` can mirror `Entry.createdAt`/`updatedAt`/`localeCode`
        // from the resolved output, not just `id`. All four are independently optional on `Sys`
        // itself (e.g. `locale` is absent on a `/sync` or wildcard-locale response), so each is
        // added only when present, matching the raw CDA response shape rather than emitting null.
        if let createdAt = entry.sys.createdAt {
            sys["createdAt"] = ISO8601DateFormatter().string(from: createdAt)
        }
        if let updatedAt = entry.sys.updatedAt {
            sys["updatedAt"] = ISO8601DateFormatter().string(from: updatedAt)
        }
        if let revision = entry.sys.revision {
            sys["revision"] = revision
        }
        if let locale = entry.sys.locale {
            sys["locale"] = locale
        }

        return [
            "sys": sys,
            "fields": entry.fields.compactMapValues { jsonValue($0, ancestors: childAncestors) },
            // Required, not cosmetic: the resolver's entry guard rejects any entry without a
            // `metadata` object, and a rejected baseline is never given its variant. A raw CDA
            // response carries it on every entry; `Entry` keeps it out of `fields`, so the
            // mapper has to put it back. `concepts` is always empty — `contentful.swift`'s
            // `Metadata` models only `tags`, so the SDK gives us nothing else to forward.
            "metadata": [
                "tags": (entry.metadata?.tags ?? []).map { jsonLink($0, ancestors: childAncestors) },
                "concepts": [],
            ],
        ]
    }

    /// One field value, reduced to something `JSONSerialization` accepts — the resolver
    /// serializes the whole map before handing it to its JS bridge, and one illegal value fails
    /// the entry outright (it falls back to baseline, logging rather than throwing). Anything
    /// not listed here is dropped rather than risking that: losing an unused field beats losing
    /// personalization on the entry that holds it.
    private static func jsonValue(_ value: Any, ancestors: Set<String>) -> Any? {
        switch value {
        case let link as Contentful.Link:
            return jsonLink(link, ancestors: ancestors)
        case let richText as Contentful.RichTextDocument:
            return jsonNode(richText, ancestors: ancestors)
        // A field of Contentful type "Object" shaped exactly like a file metadata blob
        // (`{fileName, contentType, url, details: {size, image: {width, height}}}`) decodes to
        // this type — the generic `[String: Any]` decoder (`Decodable.swift`) tries it before
        // falling back to a plain dictionary. Reuses `jsonFileMetadata`, the same helper a
        // resolved asset link's `file` field goes through.
        case let file as Contentful.Asset.FileMetadata:
            return jsonFileMetadata(file)
        case let array as [Any]:
            return array.compactMap { jsonValue($0, ancestors: ancestors) }
        case let dictionary as [String: Any]:
            return dictionary.compactMapValues { jsonValue($0, ancestors: ancestors) }
        case let location as Contentful.Location:
            return ["lat": location.latitude, "lon": location.longitude]
        case let date as Date:
            return ISO8601DateFormatter().string(from: date)
        case is String, is Int, is Double, is Bool:
            return value
        default:
            return nil
        }
    }

    /// One Structured Text node, reduced to the same `{nodeType, data, content}` shape a raw CDA
    /// response carries. `ResourceLinkBlock`/`ResourceLinkInline` (embedded entries and assets —
    /// both `-block` and `-inline` variants share these two Swift types across all five
    /// `embedded-*`/`*-hyperlink` node types) must be matched before the generic `RecursiveNode`
    /// case, since both conform to it; falling through to the generic case would silently drop
    /// the embedded resource's resolved-or-unresolved link entirely; ordering matters here.
    private static func jsonNode(_ node: Contentful.Node, ancestors: Set<String>) -> [String: Any] {
        switch node {
        case let resourceLink as Contentful.ResourceLinkBlock:
            return [
                "nodeType": resourceLink.nodeType.rawValue,
                "data": ["target": jsonLink(resourceLink.data.target, ancestors: ancestors)],
                "content": resourceLink.content.map { jsonNode($0, ancestors: ancestors) },
            ]
        case let resourceLink as Contentful.ResourceLinkInline:
            return [
                "nodeType": resourceLink.nodeType.rawValue,
                "data": ["target": jsonLink(resourceLink.data.target, ancestors: ancestors)],
                "content": resourceLink.content.map { jsonNode($0, ancestors: ancestors) },
            ]
        case let hyperlink as Contentful.Hyperlink:
            return [
                "nodeType": hyperlink.nodeType.rawValue,
                "data": ["uri": hyperlink.data.uri],
                "content": hyperlink.content.map { jsonNode($0, ancestors: ancestors) },
            ]
        case let text as Contentful.Text:
            return [
                "nodeType": text.nodeType.rawValue,
                "value": text.value,
                "marks": text.marks.map { ["type": $0.type.rawValue] },
                "data": [String: Any](),
            ]
        // Table/TableRow/TableRowHeaderCell/TableRowCell/Paragraph/Heading/BlockQuote/
        // HorizontalRule/OrderedList/UnorderedList/ListItem, and the top-level
        // RichTextDocument itself — all plain containers with no data beyond their children.
        case let recursive as Contentful.RecursiveNode:
            return [
                "nodeType": recursive.nodeType.rawValue,
                "data": [String: Any](),
                "content": recursive.content.map { jsonNode($0, ancestors: ancestors) },
            ]
        default:
            return ["nodeType": node.nodeType.rawValue, "data": [String: Any](), "content": [Any]()]
        }
    }

    /// A link field, expanded into the linked resource when the Delivery SDK resolved it.
    private static func jsonLink(_ link: Contentful.Link, ancestors: Set<String>) -> [String: Any] {
        switch link {
        case let .entry(entry) where !ancestors.contains(entry.id):
            return entryMap(entry, ancestors: ancestors)
        case let .asset(asset):
            var fields: [String: Any] = ["title": asset.title ?? ""]
            if let description = asset.description {
                fields["description"] = description
            }
            fields["file"] = asset.file.map(jsonFileMetadata) ?? ["url": asset.urlString ?? ""]
            return ["sys": ["id": asset.id, "type": "Asset"], "fields": fields]
        case let .unresolved(sys):
            return ["sys": ["id": sys.id, "type": sys.type, "linkType": sys.linkType]]
        // A back-edge, or a typed `EntryDecodable` this mapper never registers: emit the stub an
        // unresolved link has in a raw CDA response.
        case .entry, .entryDecodable:
            return ["sys": ["id": link.id, "type": "Link", "linkType": "Entry"]]
        }
    }

    /// An asset's `file` metadata, reduced to the raw CDA response shape
    /// (`{fileName, contentType, details: {size, image: {width, height}}, url}`) — the same shape
    /// whether it arrived via a resolved asset link (`jsonLink`'s `.asset` case) or as a directly
    /// decoded field value (`jsonValue`'s `Asset.FileMetadata` case, for a custom "Object" field
    /// shaped like one). `details.image` is only present for image files.
    private static func jsonFileMetadata(_ file: Contentful.Asset.FileMetadata) -> [String: Any] {
        var details: [String: Any] = ["size": file.details?.size ?? 0]
        if let imageInfo = file.details?.imageInfo {
            details["image"] = ["width": imageInfo.width, "height": imageInfo.height]
        }
        return [
            "fileName": file.fileName,
            "contentType": file.contentType,
            "details": details,
            "url": file.url?.absoluteString ?? "",
        ]
    }
}
