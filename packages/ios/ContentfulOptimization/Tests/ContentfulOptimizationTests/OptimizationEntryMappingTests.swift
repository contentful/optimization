@testable import Contentful
@testable import ContentfulOptimization
import Foundation
import XCTest

/// Verifies `OptimizationEntryMapping.toOptimizationEntry` against real `contentful.swift` decodes
/// — not fabricated dicts — so the mapping is checked against actual SDK object shapes rather
/// than assumptions about them. Mirrors the scenarios `OptimizationAdapter.swift`
/// (`examples/apps/travel-guide-ios`) exists to cover: link resolution, the metadata requirement,
/// asset mapping, and the ancestor-cycle guard.
final class OptimizationEntryMappingTests: XCTestCase {
    private static let localizationContext: LocalizationContext = {
        let localeJSON = Data("""
        {"code":"en-US","default":true,"name":"English","fallbackCode":null}
        """.utf8)
        let locale = try! JSONDecoder.withoutLocalizationContext().decode(Contentful.Locale.self, from: localeJSON)
        return LocalizationContext(locales: [locale])!
    }()

    private func decodeEntry(_ json: String) throws -> Entry {
        let decoder = JSONDecoder.withoutLocalizationContext()
        decoder.update(with: Self.localizationContext)
        decoder.userInfo[.init(rawValue: "linkResolverContext")!] = NSObject()
        return try decoder.decode(Entry.self, from: Data(json.utf8))
    }

    // MARK: - Baseline shape

    func testMapsSysAndContentType() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "Hello"}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let sys = mapped["sys"] as? [String: Any]
        XCTAssertEqual(sys?["id"] as? String, "e1")
        XCTAssertEqual(sys?["type"] as? String, "Entry")
        let contentType = (sys?["contentType"] as? [String: Any])?["sys"] as? [String: Any]
        XCTAssertEqual(contentType?["id"] as? String, "landingPage")

        let fields = mapped["fields"] as? [String: Any]
        XCTAssertEqual(fields?["title"] as? String, "Hello")
    }

    /// `ResolvedEntry.createdAt`/`updatedAt`/`localeCode` (see `ResolvedEntryTests`) can only
    /// mirror real values if `entryMap`'s `sys` block actually carries them — this proves that
    /// side of the round trip, not just that `ResolvedEntry` parses whatever it's given.
    func testMapsSysTimestampsRevisionAndLocale() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US", "revision": 3,
                   "createdAt": "2024-01-01T00:00:00Z", "updatedAt": "2024-06-15T12:30:00Z",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let sys = mapped["sys"] as? [String: Any]
        XCTAssertEqual(sys?["locale"] as? String, "en-US")
        XCTAssertEqual(sys?["revision"] as? Int, 3)
        XCTAssertEqual(sys?["createdAt"] as? String, "2024-01-01T00:00:00Z")
        XCTAssertEqual(sys?["updatedAt"] as? String, "2024-06-15T12:30:00Z")
    }

    /// A `/sync` response, or one fetched with the wildcard `locale=*` query, carries no
    /// `sys.locale` — this proves the mapper omits the key entirely rather than emitting
    /// `locale: null`, matching `Entry.sys.locale`'s own optionality.
    func testOmitsSysLocaleWhenAbsentFromSource() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let sys = mapped["sys"] as? [String: Any]
        XCTAssertNil(sys?["locale"], "sys.locale must be omitted, not emitted as null, when the source entry has none")
        XCTAssertNil(sys?["createdAt"])
        XCTAssertNil(sys?["updatedAt"])
        XCTAssertNil(sys?["revision"])
    }

    // MARK: - The silent metadata requirement

    /// The resolver's entry guard (`isResolvedContentfulEntry` in
    /// `packages/universal/api-schemas/src/contentful/typeGuards.ts`) rejects any entry without a
    /// `metadata` object — silently, no error, the entry is just treated as non-optimized. `Entry`
    /// keeps `metadata` off `fields` (it's a sys-level sibling), so an entry with zero tags still
    /// needs an explicit empty `metadata.tags`/`concepts`, not an absent key.
    func testAlwaysIncludesMetadataEvenWithNoTags() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let metadata = mapped["metadata"] as? [String: Any]
        XCTAssertNotNil(metadata, "metadata must always be present or the resolver silently treats the entry as non-optimized")
        XCTAssertEqual((metadata?["tags"] as? [Any])?.count, 0)
        XCTAssertEqual((metadata?["concepts"] as? [Any])?.count, 0)
    }

    func testMapsMetadataTags() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {},
          "metadata": {"tags": [{"sys": {"id": "tag1", "linkType": "Tag", "type": "Link"}}]}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let tags = (mapped["metadata"] as? [String: Any])?["tags"] as? [[String: Any]]
        XCTAssertEqual(tags?.count, 1)
        let tagSys = tags?.first?["sys"] as? [String: Any]
        XCTAssertEqual(tagSys?["id"] as? String, "tag1")
    }

    // MARK: - Link resolution

    func testUnresolvedLinkEmitsStub() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"related": {"sys": {"id": "e2", "type": "Link", "linkType": "Entry"}}}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let fields = mapped["fields"] as? [String: Any]
        let related = fields?["related"] as? [String: Any]
        let sys = related?["sys"] as? [String: Any]
        XCTAssertEqual(sys?["id"] as? String, "e2")
        XCTAssertEqual(sys?["type"] as? String, "Link")
        XCTAssertEqual(sys?["linkType"] as? String, "Entry")
        // Unresolved: no "fields" key from a nested entryMap expansion.
        XCTAssertNil(related?["fields"])
    }

    func testResolvedEntryLinkExpandsInline() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"child": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "child entry"}
        }
        """)

        let entriesMap = ["parent": parent, "child-1": child]
        parent.resolveLinks(against: entriesMap, and: [:])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)
        let childField = (mapped["fields"] as? [String: Any])?["child"] as? [String: Any]
        XCTAssertEqual((childField?["sys"] as? [String: Any])?["id"] as? String, "child-1")
        XCTAssertEqual((childField?["fields"] as? [String: Any])?["name"] as? String, "child entry")
        // A resolved entry link's metadata must also be present, for the same reason as the root.
        XCTAssertNotNil(childField?["metadata"])
    }

    /// The Delivery SDK resolves links into shared object references, so a variant linking back
    /// to its baseline is a real cycle in the object graph, not just a data shape to defend
    /// against defensively. Recursing an already-visited entry would loop forever; the mapper
    /// must emit an unresolved-link stub for the back-edge instead.
    func testSelfReferencingLinkDoesNotRecurseInfinitely() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"child": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"backToParent": {"sys": {"id": "parent", "type": "Link", "linkType": "Entry"}}}
        }
        """)

        let entriesMap = ["parent": parent, "child-1": child]
        parent.resolveLinks(against: entriesMap, and: [:])
        child.resolveLinks(against: entriesMap, and: [:])

        // Must terminate — the assertions below are only reachable if it does.
        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)

        let childField = (mapped["fields"] as? [String: Any])?["child"] as? [String: Any]
        let backLink = (childField?["fields"] as? [String: Any])?["backToParent"] as? [String: Any]
        let backSys = backLink?["sys"] as? [String: Any]
        XCTAssertEqual(backSys?["id"] as? String, "parent")
        XCTAssertEqual(backSys?["type"] as? String, "Link", "a back-edge to an ancestor must be an unresolved-link stub, not a full expansion")
        XCTAssertNil(backLink?["fields"], "the back-edge must not have been expanded into a full entry map")
    }

    /// `NestedContentEntryView.swift` (`examples/apps/travel-guide-ios`, and the ios-sdk
    /// implementation's `NestedContentEntryView`) recurses `OptimizedEntry` through a "nested"
    /// array field, multiple levels deep — not just one level, and not just a single linear
    /// chain. `testResolvedEntryLinkExpandsInline` above only covers one level; this covers a
    /// three-level chain (grandparent -> parent -> child) plus a diamond (two siblings at the
    /// middle level both linking to the same leaf), matching the shape the reference app's
    /// recursive view actually walks.
    func testMultiLevelNestedEntriesExpandAtEveryLevel() throws {
        let grandparent = try decodeEntry("""
        {
          "sys": {"id": "grandparent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"nested": [
            {"sys": {"id": "sibling-a", "type": "Link", "linkType": "Entry"}},
            {"sys": {"id": "sibling-b", "type": "Link", "linkType": "Entry"}}
          ]}
        }
        """)
        let siblingA = try decodeEntry("""
        {
          "sys": {"id": "sibling-a", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "sibling A", "nested": [{"sys": {"id": "leaf", "type": "Link", "linkType": "Entry"}}]}
        }
        """)
        let siblingB = try decodeEntry("""
        {
          "sys": {"id": "sibling-b", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "sibling B", "nested": [{"sys": {"id": "leaf", "type": "Link", "linkType": "Entry"}}]}
        }
        """)
        let leaf = try decodeEntry("""
        {
          "sys": {"id": "leaf", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "leaf entry"}
        }
        """)

        let entriesMap = [
            "grandparent": grandparent, "sibling-a": siblingA, "sibling-b": siblingB, "leaf": leaf,
        ]
        for entry in [grandparent, siblingA, siblingB, leaf] {
            entry.resolveLinks(against: entriesMap, and: [:])
        }

        let mapped = OptimizationEntryMapping.toOptimizationEntry(grandparent)
        let nested = (mapped["fields"] as? [String: Any])?["nested"] as? [[String: Any]]
        XCTAssertEqual(nested?.count, 2)

        for (index, expectedId, expectedName) in [(0, "sibling-a", "sibling A"), (1, "sibling-b", "sibling B")] {
            let sibling = nested?[index]
            XCTAssertEqual((sibling?["sys"] as? [String: Any])?["id"] as? String, expectedId)
            let siblingFields = sibling?["fields"] as? [String: Any]
            XCTAssertEqual(siblingFields?["name"] as? String, expectedName)

            // The diamond: both siblings link to the same leaf. Scoping the ancestor guard to
            // the current path (not a global visited set) must let the leaf expand fully under
            // both, rather than treating the second sibling's reach to it as a cycle.
            let siblingLeaf = (siblingFields?["nested"] as? [[String: Any]])?.first
            XCTAssertEqual((siblingLeaf?["sys"] as? [String: Any])?["id"] as? String, "leaf")
            let leafFields = siblingLeaf?["fields"] as? [String: Any]
            XCTAssertEqual(leafFields?["name"] as? String, "leaf entry", "the shared leaf must fully expand under both siblings, not just the first")
        }
    }

    // MARK: - Asset mapping

    func testResolvedAssetLinkMapsTitleAndURL() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"image": {"sys": {"id": "asset-1", "type": "Link", "linkType": "Asset"}}}
        }
        """)
        let assetDecoder = JSONDecoder.withoutLocalizationContext()
        assetDecoder.update(with: Self.localizationContext)
        assetDecoder.userInfo[.init(rawValue: "linkResolverContext")!] = NSObject()
        let asset = try assetDecoder.decode(Asset.self, from: Data("""
        {
          "sys": {"id": "asset-1", "type": "Asset", "locale": "en-US"},
          "fields": {"title": "A photo", "file": {"fileName": "a.jpg", "contentType": "image/jpeg",
                       "details": {"size": 10}, "url": "//images.ctfassets.net/a.jpg"}}
        }
        """.utf8))

        entry.resolveLinks(against: [:], and: ["asset-1": asset])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let image = (mapped["fields"] as? [String: Any])?["image"] as? [String: Any]
        XCTAssertEqual((image?["sys"] as? [String: Any])?["id"] as? String, "asset-1")
        let imageFields = image?["fields"] as? [String: Any]
        XCTAssertEqual(imageFields?["title"] as? String, "A photo")
        let file = imageFields?["file"] as? [String: Any]
        XCTAssertEqual(file?["url"] as? String, "https://images.ctfassets.net/a.jpg")
    }

    /// `Asset` exposes `description`, `file.contentType`, and `file.details.{size,image}` beyond
    /// `title`/`file.url` — the previous mapping dropped all of them. This proves the full asset
    /// shape survives, not just the two fields the minimal mapping used to surface.
    func testResolvedAssetLinkMapsDescriptionContentTypeSizeAndImageDimensions() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"image": {"sys": {"id": "asset-1", "type": "Link", "linkType": "Asset"}}}
        }
        """)
        let assetDecoder = JSONDecoder.withoutLocalizationContext()
        assetDecoder.update(with: Self.localizationContext)
        assetDecoder.userInfo[.init(rawValue: "linkResolverContext")!] = NSObject()
        let asset = try assetDecoder.decode(Asset.self, from: Data("""
        {
          "sys": {"id": "asset-1", "type": "Asset", "locale": "en-US"},
          "fields": {"title": "A photo", "description": "A scenic view",
                       "file": {"fileName": "a.jpg", "contentType": "image/jpeg",
                       "details": {"size": 1024, "image": {"width": 800, "height": 600}},
                       "url": "//images.ctfassets.net/a.jpg"}}
        }
        """.utf8))

        entry.resolveLinks(against: [:], and: ["asset-1": asset])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let imageFields = ((mapped["fields"] as? [String: Any])?["image"] as? [String: Any])?["fields"] as? [String: Any]
        XCTAssertEqual(imageFields?["description"] as? String, "A scenic view")
        let file = imageFields?["file"] as? [String: Any]
        XCTAssertEqual(file?["fileName"] as? String, "a.jpg")
        XCTAssertEqual(file?["contentType"] as? String, "image/jpeg")
        let details = file?["details"] as? [String: Any]
        XCTAssertEqual(details?["size"] as? Int, 1024)
        let image = details?["image"] as? [String: Any]
        XCTAssertEqual(image?["width"] as? Double, 800)
        XCTAssertEqual(image?["height"] as? Double, 600)
    }

    /// A non-image asset's `file.details` has no `image` key at all in a raw CDA response — this
    /// proves the mapper omits the key rather than emitting `image: null` or a zeroed dimension.
    func testResolvedAssetLinkWithoutDescriptionOrImageOmitsThoseKeys() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"attachment": {"sys": {"id": "asset-1", "type": "Link", "linkType": "Asset"}}}
        }
        """)
        let assetDecoder = JSONDecoder.withoutLocalizationContext()
        assetDecoder.update(with: Self.localizationContext)
        assetDecoder.userInfo[.init(rawValue: "linkResolverContext")!] = NSObject()
        let asset = try assetDecoder.decode(Asset.self, from: Data("""
        {
          "sys": {"id": "asset-1", "type": "Asset", "locale": "en-US"},
          "fields": {"title": "A PDF", "file": {"fileName": "doc.pdf", "contentType": "application/pdf",
                       "details": {"size": 2048}, "url": "//assets.ctfassets.net/doc.pdf"}}
        }
        """.utf8))

        entry.resolveLinks(against: [:], and: ["asset-1": asset])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let attachmentFields = ((mapped["fields"] as? [String: Any])?["attachment"] as? [String: Any])?["fields"] as? [String: Any]
        XCTAssertNil(attachmentFields?["description"], "an asset with no description must omit the key, not emit an empty string or null")
        let details = (attachmentFields?["file"] as? [String: Any])?["details"] as? [String: Any]
        XCTAssertNil(details?["image"], "a non-image asset's details must omit the image key entirely")
        XCTAssertEqual(details?["size"] as? Int, 2048)
    }

    /// `Asset.file` is `nil` when a `select()` query excludes it, or the media is still
    /// processing after upload — a raw CDA response's `fields` in that case carries no `file` key
    /// at all. This proves the mapper falls back to `urlString` instead of crashing on
    /// `asset.file`'s optional or emitting a `file` key shaped like `jsonFileMetadata`'s output
    /// with missing pieces.
    func testResolvedAssetLinkWithoutFileFallsBackToURLStringShape() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"image": {"sys": {"id": "asset-1", "type": "Link", "linkType": "Asset"}}}
        }
        """)
        let assetDecoder = JSONDecoder.withoutLocalizationContext()
        assetDecoder.update(with: Self.localizationContext)
        assetDecoder.userInfo[.init(rawValue: "linkResolverContext")!] = NSObject()
        // No "file" key at all — the shape a `select(fields: ["title"])` query or a
        // still-processing upload produces.
        let asset = try assetDecoder.decode(Asset.self, from: Data("""
        {
          "sys": {"id": "asset-1", "type": "Asset", "locale": "en-US"},
          "fields": {"title": "Still processing"}
        }
        """.utf8))

        entry.resolveLinks(against: [:], and: ["asset-1": asset])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let imageFields = ((mapped["fields"] as? [String: Any])?["image"] as? [String: Any])?["fields"] as? [String: Any]
        XCTAssertEqual(imageFields?["title"] as? String, "Still processing")
        let file = imageFields?["file"] as? [String: Any]
        XCTAssertEqual(file?["url"] as? String, "", "with no file metadata, the mapper must still emit a file.url key (empty), matching the pre-existing fallback shape")
        XCTAssertNil(file?["fileName"], "the fallback shape must not claim fileName/contentType/details it doesn't have")
    }

    // MARK: - Location

    func testLocationFieldMapsToLatLon() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"place": {"lat": 51.5, "lon": -0.12}}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let place = (mapped["fields"] as? [String: Any])?["place"] as? [String: Any]
        XCTAssertEqual(place?["lat"] as? Double, 51.5)
        XCTAssertEqual(place?["lon"] as? Double, -0.12)
    }

    // MARK: - Rich text

    /// Plain Structured Text nodes (paragraph, text-with-marks, hyperlink) must round-trip
    /// through the mapper, not just links/assets. If `RichTextDocument` had no case in
    /// `jsonValue`, the entire field would silently vanish — this is the regression that case
    /// closes.
    func testRichTextPlainNodesMapToNodeTree() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "text", "value": "Hello ", "marks": [], "data": {}},
                {"nodeType": "text", "value": "world", "marks": [{"type": "bold"}], "data": {}}
              ]},
              {"nodeType": "hyperlink", "data": {"uri": "https://example.com"}, "content": [
                {"nodeType": "text", "value": "click", "marks": [], "data": {}}
              ]}
            ]
          }}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        XCTAssertEqual(body?["nodeType"] as? String, "document")

        let content = body?["content"] as? [[String: Any]]
        XCTAssertEqual(content?.count, 2)

        let paragraph = content?[0]
        XCTAssertEqual(paragraph?["nodeType"] as? String, "paragraph")
        let paragraphContent = paragraph?["content"] as? [[String: Any]]
        XCTAssertEqual(paragraphContent?[0]["value"] as? String, "Hello ")
        XCTAssertEqual(paragraphContent?[1]["value"] as? String, "world")
        let marks = paragraphContent?[1]["marks"] as? [[String: Any]]
        XCTAssertEqual(marks?.first?["type"] as? String, "bold")

        let hyperlink = content?[1]
        XCTAssertEqual(hyperlink?["nodeType"] as? String, "hyperlink")
        XCTAssertEqual((hyperlink?["data"] as? [String: Any])?["uri"] as? String, "https://example.com")
        let hyperlinkContent = hyperlink?["content"] as? [[String: Any]]
        XCTAssertEqual(hyperlinkContent?.first?["value"] as? String, "click")
    }

    /// The one case this whole addition exists for: an embedded entry inside rich text that the
    /// Delivery SDK *did* resolve must expand inline — same as a top-level resolved link — not
    /// disappear.
    func testResolvedEmbeddedEntryBlockExpandsInline() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}},
               "content": []}
            ]
          }}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "embedded child"}
        }
        """)

        parent.resolveLinks(against: ["parent": parent, "child-1": child], and: [:])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let embeddedBlock = (body?["content"] as? [[String: Any]])?.first
        XCTAssertEqual(embeddedBlock?["nodeType"] as? String, "embedded-entry-block")

        let target = (embeddedBlock?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((target?["sys"] as? [String: Any])?["id"] as? String, "child-1")
        let targetFields = target?["fields"] as? [String: Any]
        XCTAssertEqual(targetFields?["name"] as? String, "embedded child", "a resolved embedded entry must expand inline, matching a top-level resolved link")
        XCTAssertNotNil(target?["metadata"], "an expanded embedded entry must carry metadata, same as any other expanded entry")
    }

    /// The other case that must not be dropped: an embedded entry the Delivery SDK could *not*
    /// resolve (e.g. unpublished, or outside the query's `include` depth) must still surface as
    /// an unresolved-link stub — not vanish, and not be confused with the resolved case above.
    func testUnresolvedEmbeddedEntryBlockEmitsStubNotOmission() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {"sys": {"id": "missing-1", "type": "Link", "linkType": "Entry"}}},
               "content": []}
            ]
          }}
        }
        """)
        // Deliberately not calling resolveLinks — no candidate entries were ever supplied, the
        // shape a query with insufficient `include` depth or an unpublished target produces.

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let embeddedBlock = (body?["content"] as? [[String: Any]])?.first
        XCTAssertNotNil(embeddedBlock, "an unresolved embedded entry must still appear as a node — not be silently dropped from content")
        XCTAssertEqual(embeddedBlock?["nodeType"] as? String, "embedded-entry-block")

        let target = (embeddedBlock?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((target?["sys"] as? [String: Any])?["id"] as? String, "missing-1")
        XCTAssertEqual((target?["sys"] as? [String: Any])?["linkType"] as? String, "Entry")
        XCTAssertNil(target?["fields"], "an unresolved target must be a link stub, not an expanded entry")
    }

    /// Same resolved/unresolved distinction, but for an embedded *asset* rather than an entry —
    /// a separate code path (`.asset` vs `.entry`/`.unresolved` in `jsonLink`) that must not be
    /// conflated with the entry case above.
    func testResolvedEmbeddedAssetBlockExpandsWithTitleAndURL() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-asset-block",
               "data": {"target": {"sys": {"id": "asset-1", "type": "Link", "linkType": "Asset"}}},
               "content": []}
            ]
          }}
        }
        """)
        let assetDecoder = JSONDecoder.withoutLocalizationContext()
        assetDecoder.update(with: Self.localizationContext)
        assetDecoder.userInfo[.init(rawValue: "linkResolverContext")!] = NSObject()
        let asset = try assetDecoder.decode(Asset.self, from: Data("""
        {
          "sys": {"id": "asset-1", "type": "Asset", "locale": "en-US"},
          "fields": {"title": "An image", "file": {"fileName": "b.png", "contentType": "image/png",
                       "details": {"size": 20}, "url": "//images.ctfassets.net/b.png"}}
        }
        """.utf8))

        entry.resolveLinks(against: [:], and: ["asset-1": asset])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let embeddedBlock = (body?["content"] as? [[String: Any]])?.first
        let target = (embeddedBlock?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((target?["sys"] as? [String: Any])?["id"] as? String, "asset-1")
        let targetFields = target?["fields"] as? [String: Any]
        XCTAssertEqual(targetFields?["title"] as? String, "An image")
        let file = targetFields?["file"] as? [String: Any]
        XCTAssertEqual(file?["url"] as? String, "https://images.ctfassets.net/b.png")
    }

    /// Embedded-entry-*inline* (a different Swift type, `ResourceLinkInline`, from the block
    /// variant tested above) must also expand a resolved target, proving the inline node-type
    /// branch isn't just a copy-paste of the block branch that happens to compile.
    func testResolvedEmbeddedEntryInlineExpandsInline() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "embedded-entry-inline",
                 "data": {"target": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}},
                 "content": []}
              ]}
            ]
          }}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "inline child"}
        }
        """)

        parent.resolveLinks(against: ["parent": parent, "child-1": child], and: [:])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let paragraph = (body?["content"] as? [[String: Any]])?.first
        let inlineNode = (paragraph?["content"] as? [[String: Any]])?.first
        XCTAssertEqual(inlineNode?["nodeType"] as? String, "embedded-entry-inline")
        let target = (inlineNode?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((target?["fields"] as? [String: Any])?["name"] as? String, "inline child")
    }

    /// `entry-hyperlink` and `asset-hyperlink` decode to the same `ResourceLinkInline` Swift type
    /// as `embedded-entry-inline` (confirmed against a real decode — `NodeType.type` maps all
    /// three to `ResourceLinkInline.self`), so `jsonNode`'s type-based switch already covers them
    /// without a dedicated case. This test proves that's actually true for `entry-hyperlink`
    /// specifically, not just architecturally plausible — a hyperlink-to-an-entry is a distinct
    /// authoring action from an embedded block, and CDA gives it a different `nodeType` string.
    func testEntryHyperlinkExpandsResolvedTargetInline() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "entry-hyperlink",
                 "data": {"target": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}},
                 "content": [{"nodeType": "text", "value": "link text", "marks": [], "data": {}}]}
              ]}
            ]
          }}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"name": "linked child"}
        }
        """)

        parent.resolveLinks(against: ["parent": parent, "child-1": child], and: [:])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let paragraph = (body?["content"] as? [[String: Any]])?.first
        let hyperlinkNode = (paragraph?["content"] as? [[String: Any]])?.first
        XCTAssertEqual(hyperlinkNode?["nodeType"] as? String, "entry-hyperlink")
        let target = (hyperlinkNode?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((target?["fields"] as? [String: Any])?["name"] as? String, "linked child")
        let hyperlinkContent = hyperlinkNode?["content"] as? [[String: Any]]
        XCTAssertEqual(hyperlinkContent?.first?["value"] as? String, "link text")
    }

    /// `asset-hyperlink` — same `ResourceLinkInline` type, distinct `nodeType`, unresolved this
    /// time (mirrors the unresolved-embedded-entry test's point: neither hyperlink variant should
    /// be assumed resolved).
    func testAssetHyperlinkEmitsUnresolvedStubWhenNotResolved() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "asset-hyperlink",
                 "data": {"target": {"sys": {"id": "asset-1", "type": "Link", "linkType": "Asset"}}},
                 "content": [{"nodeType": "text", "value": "asset link", "marks": [], "data": {}}]}
              ]}
            ]
          }}
        }
        """)
        // Not calling resolveLinks — no asset candidates supplied.

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let paragraph = (body?["content"] as? [[String: Any]])?.first
        let hyperlinkNode = (paragraph?["content"] as? [[String: Any]])?.first
        XCTAssertEqual(hyperlinkNode?["nodeType"] as? String, "asset-hyperlink")
        let target = (hyperlinkNode?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((target?["sys"] as? [String: Any])?["id"] as? String, "asset-1")
        XCTAssertNil(target?["fields"], "an unresolved asset-hyperlink target must be a stub, not an expanded asset")
    }

    /// Confirmed via a real decode (scratch probe, since removed) that a rich text field
    /// embedding an entry which itself has a rich text field is a real, reachable shape — not
    /// hypothetical. This proves the mapper's field-recursion and node-recursion compose across
    /// that boundary: an embedded entry's own rich text field must expand, not just its plain
    /// fields (already covered by `testResolvedEmbeddedEntryBlockExpandsInline`).
    func testRichTextInsideEmbeddedEntryFieldsAlsoExpands() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}},
               "content": []}
            ]
          }}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"nestedBody": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "text", "value": "nested rich text", "marks": [], "data": {}}
              ]}
            ]
          }}
        }
        """)

        parent.resolveLinks(against: ["parent": parent, "child-1": child], and: [:])

        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)
        let body = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let embeddedBlock = (body?["content"] as? [[String: Any]])?.first
        let target = (embeddedBlock?["data"] as? [String: Any])?["target"] as? [String: Any]
        let targetFields = target?["fields"] as? [String: Any]

        let nestedBody = targetFields?["nestedBody"] as? [String: Any]
        XCTAssertEqual(nestedBody?["nodeType"] as? String, "document", "an embedded entry's own rich text field must also expand, not just its plain fields")
        let nestedParagraph = (nestedBody?["content"] as? [[String: Any]])?.first
        let nestedText = (nestedParagraph?["content"] as? [[String: Any]])?.first
        XCTAssertEqual(nestedText?["value"] as? String, "nested rich text")
    }

    /// Confirmed via a real decode (scratch probe, since removed) that this is a genuine object
    /// graph cycle, not a hypothetical one: after `resolveLinks`, the child's back-reference to
    /// the parent inside rich text resolves to `.entry(parent)`, an actual `Entry` reference —
    /// recursing it without the ancestor guard would loop forever. This is the rich-text
    /// counterpart to `testSelfReferencingLinkDoesNotRecurseInfinitely` (which only covers a
    /// plain top-level field link), proving the same guard also holds across the
    /// field-recursion/node-recursion boundary rich text introduces.
    func testRichTextEmbeddedEntryCycleDoesNotRecurseInfinitely() throws {
        let parent = try decodeEntry("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {"sys": {"id": "child-1", "type": "Link", "linkType": "Entry"}}},
               "content": []}
            ]
          }}
        }
        """)
        let child = try decodeEntry("""
        {
          "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {"sys": {"id": "parent", "type": "Link", "linkType": "Entry"}}},
               "content": []}
            ]
          }}
        }
        """)

        let entriesMap = ["parent": parent, "child-1": child]
        parent.resolveLinks(against: entriesMap, and: [:])
        child.resolveLinks(against: entriesMap, and: [:])

        // Must terminate — the assertions below are only reachable if it does.
        let mapped = OptimizationEntryMapping.toOptimizationEntry(parent)

        let parentBody = (mapped["fields"] as? [String: Any])?["body"] as? [String: Any]
        let embeddedChildBlock = (parentBody?["content"] as? [[String: Any]])?.first
        let childTarget = (embeddedChildBlock?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((childTarget?["sys"] as? [String: Any])?["id"] as? String, "child-1")

        let childBody = (childTarget?["fields"] as? [String: Any])?["body"] as? [String: Any]
        let embeddedBackBlock = (childBody?["content"] as? [[String: Any]])?.first
        let backTarget = (embeddedBackBlock?["data"] as? [String: Any])?["target"] as? [String: Any]
        XCTAssertEqual((backTarget?["sys"] as? [String: Any])?["id"] as? String, "parent")
        XCTAssertEqual((backTarget?["sys"] as? [String: Any])?["type"] as? String, "Link", "the back-edge inside rich text must be an unresolved-link stub, not a full re-expansion")
        XCTAssertNil(backTarget?["fields"], "the rich-text back-edge must not have been expanded into a full entry map")
    }

    // MARK: - Date fields

    /// `contentful.swift`'s generic `[String: Any]` field decoder
    /// (`Decodable.swift`'s `KeyedDecodingContainer.decode(_: [String: Any].Type)`) tries `Bool`,
    /// then `String`, before any date-specific type. A Contentful "Date" field is a JSON string
    /// (e.g. `"2024-06-15T12:30:00Z"`), so it is captured by the `String` branch and surfaces in
    /// `entry.fields` as `String`, never as Swift `Date`. Verified empirically against a real
    /// decode. This means `OptimizationEntryMapping`'s `case let date as Date` branch (ported
    /// faithfully from `OptimizationAdapter.swift`, which has the same dead branch) can only ever
    /// trigger for a `Date` placed into the dict programmatically — never for a field decoded
    /// from a real CDA response. Documented here rather than silently dropped, since removing it
    /// would diverge from the reference file without a call to do so.
    func testDateLikeFieldDecodesAsPlainStringNotSwiftDate() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"publishDate": "2024-06-15T12:30:00Z"}
        }
        """)

        XCTAssertTrue(entry.fields["publishDate"] is String)
        XCTAssertFalse(entry.fields["publishDate"] is Date)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        XCTAssertEqual((mapped["fields"] as? [String: Any])?["publishDate"] as? String, "2024-06-15T12:30:00Z")
    }

    // MARK: - Unsupported values are dropped, not thrown

    func testUnsupportedFieldTypeIsDroppedNotThrown() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "kept", "count": 3}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let fields = mapped["fields"] as? [String: Any]
        XCTAssertEqual(fields?["title"] as? String, "kept")
        XCTAssertEqual(fields?["count"] as? Int, 3)
    }

    // MARK: - Asset.FileMetadata decoded directly as a field value

    /// A field of Contentful type "Object" shaped exactly like a file metadata blob decodes to
    /// `Asset.FileMetadata` directly — no `Asset`/`Link` wrapper at all (contentful.swift's
    /// generic `[String: Any]` field decoder tries `Asset.FileMetadata` before falling back to a
    /// plain dictionary). This is distinct from `testResolvedAssetLinkMapsDescriptionContentTypeSizeAndImageDimensions`,
    /// which covers the same shape arriving through a resolved asset *link* instead.
    func testFileMetadataShapedObjectFieldMapsSameAsAssetFile() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"rawFile": {"fileName": "raw.png", "contentType": "image/png",
                       "details": {"size": 512, "image": {"width": 100, "height": 50}},
                       "url": "//images.ctfassets.net/raw.png"}}
        }
        """)

        let mapped = OptimizationEntryMapping.toOptimizationEntry(entry)
        let rawFile = (mapped["fields"] as? [String: Any])?["rawFile"] as? [String: Any]
        XCTAssertEqual(rawFile?["fileName"] as? String, "raw.png")
        XCTAssertEqual(rawFile?["contentType"] as? String, "image/png")
        XCTAssertEqual(rawFile?["url"] as? String, "https://images.ctfassets.net/raw.png")
        let details = rawFile?["details"] as? [String: Any]
        XCTAssertEqual(details?["size"] as? Int, 512)
        let image = details?["image"] as? [String: Any]
        XCTAssertEqual(image?["width"] as? Double, 100)
        XCTAssertEqual(image?["height"] as? Double, 50)
    }
}
