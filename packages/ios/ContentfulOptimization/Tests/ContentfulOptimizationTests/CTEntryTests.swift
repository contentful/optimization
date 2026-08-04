@testable import Contentful
@testable import ContentfulOptimization
import Foundation
import XCTest

/// Compares two JSON strings by their parsed `JSONValue` tree, not raw text — so
/// whitespace/key-order differences don't cause a false mismatch.
func assertJSONEqual(
    _ lhs: String,
    _ rhs: String,
    file: StaticString = #filePath,
    line: UInt = #line
) throws {
    XCTAssertEqual(
        try JSONDecoder().decode(JSONValue.self, from: Data(lhs.utf8)),
        try JSONDecoder().decode(JSONValue.self, from: Data(rhs.utf8)),
        file: file,
        line: line
    )
}

/// Direct unit tests for `CTEntry` — both directions of the `Contentful.Entry <-> JSON`
/// boundary it owns, in one file since both test the same type:
///
/// - **Encoding** (`init(_: Contentful.Entry)`): verified against real `contentful.swift`
///   decodes — not fabricated dicts — so the encoding is checked against actual SDK object
///   shapes rather than assumptions about them. Mirrors the scenarios `OptimizationAdapter.swift`
///   (`examples/apps/travel-guide-ios`) exists to cover: link resolution, the metadata
///   requirement, asset mapping, and the ancestor-cycle guard. Every test compares whole
///   `JSONValue` trees via `assertJSONEqual`, never a field-by-field `as?` dig — that catches an
///   unexpected extra/missing key anywhere in the tree, not just on the fields a test happens to
///   name. Where the mapper is the identity on its input (no links, no rich text, nothing to
///   expand), the test has one JSON literal and asserts the mapped output equals it unchanged.
///   Where the mapper transforms its input (a link expands, a URL gets a scheme, a stub emits),
///   the test has an `input` literal and a separately written `expected` literal, and asserts the
///   mapped output equals `expected` — never the identity of `input`.
/// - **Reading** (the `getField`/`id`/`localeCode`/`createdAt`/`updatedAt`/subscript surface):
///   the happy path is already exercised indirectly by every encoding test above (each reads the
///   mapped `CTEntry` back via `toJSON`); the tests near the bottom of this file cover the
///   absent/wrong-type cases (a resolver output missing `sys`/`fields`, or a field read back as
///   the wrong type) that the encoding tests have no reason to exercise.
final class CTEntryTests: XCTestCase {
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

    /// The common shape for a test where the mapper is the identity on its input: decode
    /// `input`, map it, and assert the mapped output equals `input` unchanged (parsed-JSON
    /// comparison, not raw text — see `assertJSONEqual`).
    private func assertIdentity(_ input: String, file: StaticString = #filePath, line: UInt = #line) throws {
        let entry = try decodeEntry(input)
        let result = try CTEntry(entry).toJSON()
        try assertJSONEqual(input, result, file: file, line: line)
    }

    // MARK: - Baseline shape

    /// Identity: a baseline entry with no links/rich text/assets maps to the same *parsed JSON*
    /// as the raw CDA response that produced it — `metadata` included in the literal itself,
    /// since `from(_:)` always adds it (see `testAlwaysIncludesMetadataEvenWithNoTags` below,
    /// where that's the transformation under test).
    func testMapsSysAndContentType() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "Hello"},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    /// Identity: proves `sys.createdAt`/`updatedAt`/`revision`/`locale` all survive the round
    /// trip unchanged — `ResolvedEntry.createdAt`/`updatedAt`/`localeCode` (see
    /// `ResolvedEntryTests`) can only mirror real values if `entryMap`'s `sys` block actually
    /// carries them.
    func testMapsSysTimestampsRevisionAndLocale() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US", "revision": 3,
                   "createdAt": "2024-01-01T00:00:00Z", "updatedAt": "2024-06-15T12:30:00Z",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    /// Identity: a `/sync` response, or one fetched with the wildcard `locale=*` query, carries
    /// no `sys.locale` — this proves the mapper omits the key entirely rather than emitting
    /// `locale: null`, matching `Entry.sys.locale`'s own optionality.
    func testOmitsSysLocaleWhenAbsentFromSource() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    // MARK: - The silent metadata requirement

    /// Transformation: the resolver's entry guard (`isResolvedContentfulEntry` in
    /// `packages/universal/api-schemas/src/contentful/typeGuards.ts`) rejects any entry without a
    /// `metadata` object — silently, no error, the entry is just treated as non-optimized.
    /// `Entry` keeps `metadata` off `fields` (it's a sys-level sibling), so an entry with zero
    /// tags still needs an explicit empty `metadata.tags`/`concepts` added by the mapper, not an
    /// absent key — the raw `input` here has no `metadata` key at all.
    func testAlwaysIncludesMetadataEvenWithNoTags() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {}
        }
        """)

        let result = try CTEntry(entry).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Identity: an existing tag link round-trips into `metadata.tags` unchanged.
    func testMapsMetadataTags() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {},
          "metadata": {"tags": [{"sys": {"id": "tag1", "linkType": "Tag", "type": "Link"}}], "concepts": []}
        }
        """)
    }

    // MARK: - Link resolution

    /// Identity: an entry link the Delivery SDK could not resolve stays exactly the unresolved
    /// stub shape it arrived as.
    func testUnresolvedLinkEmitsStub() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"related": {"sys": {"id": "e2", "type": "Link", "linkType": "Entry"}}},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    /// Transformation: a resolved entry link expands inline into the full nested entry
    /// (`sys`/`fields`/`metadata`) instead of staying a link stub.
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

        let result = try CTEntry(parent).toJSON()

        // A resolved entry link's metadata must also be present, for the same reason as the root.
        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"child": {
            "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                     "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
            "fields": {"name": "child entry"},
            "metadata": {"tags": [], "concepts": []}
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: the Delivery SDK resolves links into shared object references, so a
    /// variant that links back to its baseline is a real cycle in the object graph, not just a
    /// data shape to defend against defensively. Recursing an already-visited entry would loop
    /// forever; the mapper emits an unresolved-link stub for the back-edge instead — the whole
    /// tree is asserted, not just the back-edge, so the expansion up to that point is checked too.
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

        // Must terminate — the assertion below is only reachable if it does.
        let result = try CTEntry(parent).toJSON()

        // The back-edge to "parent" is an unresolved-link stub (no "fields"/"metadata"), not a
        // full re-expansion — everything up to it has expanded normally.
        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"child": {
            "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                     "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
            "fields": {"backToParent": {"sys": {"id": "parent", "type": "Link", "linkType": "Entry"}}},
            "metadata": {"tags": [], "concepts": []}
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: `NestedContentEntryView.swift` (`examples/apps/travel-guide-ios`, and the
    /// ios-sdk implementation's `NestedContentEntryView`) recurses `OptimizedEntry` through a
    /// "nested" array field, multiple levels deep — not just one level, and not just a single
    /// linear chain. `testResolvedEntryLinkExpandsInline` above only covers one level; this
    /// covers a three-level chain (grandparent -> parent -> child) plus a diamond (two siblings
    /// at the middle level both linking to the same leaf), matching the shape the reference
    /// app's recursive view actually walks — asserting the whole tree proves the diamond expands
    /// fully under both siblings, not just the first.
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

        let result = try CTEntry(grandparent).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "grandparent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"nested": [
            {
              "sys": {"id": "sibling-a", "type": "Entry", "locale": "en-US",
                       "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"name": "sibling A", "nested": [
                {
                  "sys": {"id": "leaf", "type": "Entry", "locale": "en-US",
                           "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                  "fields": {"name": "leaf entry"},
                  "metadata": {"tags": [], "concepts": []}
                }
              ]},
              "metadata": {"tags": [], "concepts": []}
            },
            {
              "sys": {"id": "sibling-b", "type": "Entry", "locale": "en-US",
                       "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"name": "sibling B", "nested": [
                {
                  "sys": {"id": "leaf", "type": "Entry", "locale": "en-US",
                           "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                  "fields": {"name": "leaf entry"},
                  "metadata": {"tags": [], "concepts": []}
                }
              ]},
              "metadata": {"tags": [], "concepts": []}
            }
          ]},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: `testMultiLevelNestedEntriesExpandAtEveryLevel` only proves 3 levels
    /// expand; a depth-limit bug (e.g. an accidental cap, or an off-by-one in how `ancestors` is
    /// threaded through each recursive call) could still exist beyond that. This chains 5 levels
    /// (l1 -> l2 -> l3 -> l4 -> l5) through a single-entry `child` link at each hop — not a
    /// diamond or a cycle — and asserts the whole 5-deep tree, to prove recursion itself has no
    /// hidden depth ceiling.
    func testFiveLevelLinearChainExpandsAtEveryLevel() throws {
        func entryJSON(level: Int) -> String {
            let childField = level < 5
                ? """
                , "child": {"sys": {"id": "l\(level + 1)", "type": "Link", "linkType": "Entry"}}
                """
                : ""
            return """
            {
              "sys": {"id": "l\(level)", "type": "Entry", "locale": "en-US",
                       "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"name": "level \(level)"\(childField)}
            }
            """
        }
        let levels = try (1 ... 5).map { try decodeEntry(entryJSON(level: $0)) }
        let entriesMap = Dictionary(uniqueKeysWithValues: levels.map { ($0.id, $0) })
        for entry in levels {
            entry.resolveLinks(against: entriesMap, and: [:])
        }

        let result = try CTEntry(levels[0]).toJSON()

        func expectedJSON(level: Int) -> String {
            let childField = level < 5
                ? """
                , "child": \(expectedJSON(level: level + 1))
                """
                : ""
            return """
            {
              "sys": {"id": "l\(level)", "type": "Entry", "locale": "en-US",
                       "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"name": "level \(level)"\(childField)},
              "metadata": {"tags": [], "concepts": []}
            }
            """
        }

        try assertJSONEqual(expectedJSON(level: 1), result)
    }

    /// Transformation: the existing cycle tests (`testSelfReferencingLinkDoesNotRecurseInfinitely`,
    /// `testRichTextEmbeddedEntryCycleDoesNotRecurseInfinitely`) only cover a 2-node cycle
    /// (parent <-> child). This proves the ancestor guard also terminates a longer cycle —
    /// a -> b -> c -> a — where the back-edge closes several hops later rather than immediately,
    /// so a bug that only checked the immediate parent (instead of the full `ancestors` path)
    /// would not be caught by the 2-node case alone.
    func testThreeNodeCycleDoesNotRecurseInfinitely() throws {
        let a = try decodeEntry("""
        {
          "sys": {"id": "a", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"next": {"sys": {"id": "b", "type": "Link", "linkType": "Entry"}}}
        }
        """)
        let b = try decodeEntry("""
        {
          "sys": {"id": "b", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"next": {"sys": {"id": "c", "type": "Link", "linkType": "Entry"}}}
        }
        """)
        let c = try decodeEntry("""
        {
          "sys": {"id": "c", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"next": {"sys": {"id": "a", "type": "Link", "linkType": "Entry"}}}
        }
        """)

        let entriesMap = ["a": a, "b": b, "c": c]
        for entry in [a, b, c] {
            entry.resolveLinks(against: entriesMap, and: [:])
        }

        // Must terminate — the assertion below is only reachable if it does.
        let result = try CTEntry(a).toJSON()

        // "a" -> "b" -> "c" all expand fully; "c"'s "next" closing the cycle back to "a" is an
        // unresolved-link stub, not a full re-expansion.
        try assertJSONEqual("""
        {
          "sys": {"id": "a", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"next": {
            "sys": {"id": "b", "type": "Entry", "locale": "en-US",
                     "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
            "fields": {"next": {
              "sys": {"id": "c", "type": "Entry", "locale": "en-US",
                       "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
              "fields": {"next": {"sys": {"id": "a", "type": "Link", "linkType": "Entry"}}},
              "metadata": {"tags": [], "concepts": []}
            }},
            "metadata": {"tags": [], "concepts": []}
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    // MARK: - Asset mapping

    /// Transformation: a resolved asset link expands into `{sys, fields: {title, file}}`, and
    /// the CDA-style protocol-relative `//` URL gets an explicit `https:` scheme.
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

        let result = try CTEntry(entry).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"image": {
            "sys": {"id": "asset-1", "type": "Asset"},
            "fields": {
              "title": "A photo",
              "file": {"fileName": "a.jpg", "contentType": "image/jpeg",
                       "details": {"size": 10}, "url": "https://images.ctfassets.net/a.jpg"}
            }
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: `Asset` exposes `description`, `file.contentType`, and
    /// `file.details.{size,image}` beyond `title`/`file.url` — the previous mapping dropped all
    /// of them. This proves the full asset shape survives, not just the two fields the minimal
    /// mapping used to surface.
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

        let result = try CTEntry(entry).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"image": {
            "sys": {"id": "asset-1", "type": "Asset"},
            "fields": {
              "title": "A photo",
              "description": "A scenic view",
              "file": {"fileName": "a.jpg", "contentType": "image/jpeg",
                       "details": {"size": 1024, "image": {"width": 800, "height": 600}},
                       "url": "https://images.ctfassets.net/a.jpg"}
            }
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: a non-image asset's `file.details` has no `image` key at all in a raw CDA
    /// response — this proves the mapper omits the key rather than emitting `image: null` or a
    /// zeroed dimension, and that a missing `description` is omitted rather than emitted empty.
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

        let result = try CTEntry(entry).toJSON()

        // No "description" key and no "details.image" key — omitted, not null.
        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"attachment": {
            "sys": {"id": "asset-1", "type": "Asset"},
            "fields": {
              "title": "A PDF",
              "file": {"fileName": "doc.pdf", "contentType": "application/pdf",
                       "details": {"size": 2048}, "url": "https://assets.ctfassets.net/doc.pdf"}
            }
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: `Asset.file` is `nil` when a `select()` query excludes it, or the media
    /// is still processing after upload — a raw CDA response's `fields` in that case carries no
    /// `file` key at all. This proves the mapper falls back to `urlString` instead of crashing on
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

        let result = try CTEntry(entry).toJSON()

        // No "fileName" key claimed — just the fallback "file.url" (empty), matching the
        // pre-existing fallback shape.
        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"image": {
            "sys": {"id": "asset-1", "type": "Asset"},
            "fields": {"title": "Still processing", "file": {"url": ""}}
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    // MARK: - Location

    /// Identity: a `Location` field round-trips as `{lat, lon}` unchanged.
    func testLocationFieldMapsToLatLon() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"place": {"lat": 51.5, "lon": -0.12}},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    // MARK: - Rich text

    /// Identity: plain Structured Text nodes (paragraph, text-with-marks, hyperlink) round-trip
    /// through the mapper unchanged, not just links/assets. If `RichTextDocument` had no case in
    /// `jsonValue`, the entire field would silently vanish — this is the regression that case
    /// closes.
    func testRichTextPlainNodesMapToNodeTree() throws {
        try assertIdentity("""
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
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    /// Transformation: the one case this whole addition exists for — an embedded entry inside
    /// rich text that the Delivery SDK *did* resolve expands inline, same as a top-level resolved
    /// link, instead of disappearing.
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

        let result = try CTEntry(parent).toJSON()

        // A resolved embedded entry must expand inline, carrying metadata same as any other
        // expanded entry.
        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {
                 "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                          "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                 "fields": {"name": "embedded child"},
                 "metadata": {"tags": [], "concepts": []}
               }},
               "content": []}
            ]
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Identity: the other case that must not be dropped — an embedded entry the Delivery SDK
    /// could *not* resolve (e.g. unpublished, or outside the query's `include` depth) still
    /// surfaces as exactly the unresolved-link stub it arrived as — not vanished, and not
    /// confused with the resolved case above.
    func testUnresolvedEmbeddedEntryBlockEmitsStubNotOmission() throws {
        // Deliberately not calling resolveLinks — no candidate entries were ever supplied, the
        // shape a query with insufficient `include` depth or an unpublished target produces.
        try assertIdentity("""
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
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    /// Transformation: same resolved/unresolved distinction, but for an embedded *asset* rather
    /// than an entry — a separate code path (`.asset` vs `.entry`/`.unresolved` in `jsonLink`)
    /// that must not be conflated with the entry case above.
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

        let result = try CTEntry(entry).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-asset-block",
               "data": {"target": {
                 "sys": {"id": "asset-1", "type": "Asset"},
                 "fields": {
                   "title": "An image",
                   "file": {"fileName": "b.png", "contentType": "image/png",
                            "details": {"size": 20}, "url": "https://images.ctfassets.net/b.png"}
                 }
               }},
               "content": []}
            ]
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: embedded-entry-*inline* (a different Swift type, `ResourceLinkInline`,
    /// from the block variant tested above) also expands a resolved target, proving the inline
    /// node-type branch isn't just a copy-paste of the block branch that happens to compile.
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

        let result = try CTEntry(parent).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "embedded-entry-inline",
                 "data": {"target": {
                   "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                            "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                   "fields": {"name": "inline child"},
                   "metadata": {"tags": [], "concepts": []}
                 }},
                 "content": []}
              ]}
            ]
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: `entry-hyperlink` and `asset-hyperlink` decode to the same
    /// `ResourceLinkInline` Swift type as `embedded-entry-inline` (confirmed against a real
    /// decode — `NodeType.type` maps all three to `ResourceLinkInline.self`), so `jsonNode`'s
    /// type-based switch already covers them without a dedicated case. This test proves that's
    /// actually true for `entry-hyperlink` specifically, not just architecturally plausible — a
    /// hyperlink-to-an-entry is a distinct authoring action from an embedded block, and CDA
    /// gives it a different `nodeType` string.
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

        let result = try CTEntry(parent).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "paragraph", "data": {}, "content": [
                {"nodeType": "entry-hyperlink",
                 "data": {"target": {
                   "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                            "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                   "fields": {"name": "linked child"},
                   "metadata": {"tags": [], "concepts": []}
                 }},
                 "content": [{"nodeType": "text", "value": "link text", "marks": [], "data": {}}]}
              ]}
            ]
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Identity: `asset-hyperlink` — same `ResourceLinkInline` type, distinct `nodeType`,
    /// unresolved this time (mirrors the unresolved-embedded-entry test's point: neither
    /// hyperlink variant should be assumed resolved) — the target stub round-trips unchanged.
    func testAssetHyperlinkEmitsUnresolvedStubWhenNotResolved() throws {
        let input = """
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
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """
        // Not calling resolveLinks — no asset candidates supplied.
        try assertIdentity(input)
    }

    /// Transformation: confirmed via a real decode (scratch probe, since removed) that a rich
    /// text field embedding an entry which itself has a rich text field is a real, reachable
    /// shape — not hypothetical. This proves the mapper's field-recursion and node-recursion
    /// compose across that boundary: an embedded entry's own rich text field expands, not just
    /// its plain fields (already covered by `testResolvedEmbeddedEntryBlockExpandsInline`).
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

        let result = try CTEntry(parent).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {
                 "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                          "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                 "fields": {"nestedBody": {
                   "nodeType": "document", "data": {},
                   "content": [
                     {"nodeType": "paragraph", "data": {}, "content": [
                       {"nodeType": "text", "value": "nested rich text", "marks": [], "data": {}}
                     ]}
                   ]
                 }},
                 "metadata": {"tags": [], "concepts": []}
               }},
               "content": []}
            ]
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    /// Transformation: confirmed via a real decode (scratch probe, since removed) that this is a
    /// genuine object graph cycle, not a hypothetical one — after `resolveLinks`, the child's
    /// back-reference to the parent inside rich text resolves to `.entry(parent)`, an actual
    /// `Entry` reference; recursing it without the ancestor guard would loop forever. This is
    /// the rich-text counterpart to `testSelfReferencingLinkDoesNotRecurseInfinitely` (which
    /// only covers a plain top-level field link), proving the same guard also holds across the
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

        // Must terminate — the assertion below is only reachable if it does.
        let result = try CTEntry(parent).toJSON()

        // "child-1" expands fully, including its own rich text field; the back-edge inside that
        // rich text closing the cycle to "parent" is an unresolved-link stub, not a
        // re-expansion.
        try assertJSONEqual("""
        {
          "sys": {"id": "parent", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"body": {
            "nodeType": "document", "data": {},
            "content": [
              {"nodeType": "embedded-entry-block",
               "data": {"target": {
                 "sys": {"id": "child-1", "type": "Entry", "locale": "en-US",
                          "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
                 "fields": {"body": {
                   "nodeType": "document", "data": {},
                   "content": [
                     {"nodeType": "embedded-entry-block",
                      "data": {"target": {"sys": {"id": "parent", "type": "Link", "linkType": "Entry"}}},
                      "content": []}
                   ]
                 }},
                 "metadata": {"tags": [], "concepts": []}
               }},
               "content": []}
            ]
          }},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    // MARK: - Date fields

    /// Identity: `contentful.swift`'s generic `[String: Any]` field decoder
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
        let input = """
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"publishDate": "2024-06-15T12:30:00Z"},
          "metadata": {"tags": [], "concepts": []}
        }
        """
        let entry = try decodeEntry(input)

        XCTAssertTrue(entry.fields["publishDate"] is String)
        XCTAssertFalse(entry.fields["publishDate"] is Date)

        let result = try CTEntry(entry).toJSON()

        try assertJSONEqual(input, result)
    }

    // MARK: - Unsupported values are dropped, not thrown

    /// Identity: a plain unsupported-but-still-encodable value (`Int`) round-trips unchanged
    /// alongside a supported one — proving nothing is dropped or thrown for ordinary field types.
    func testUnsupportedFieldTypeIsDroppedNotThrown() throws {
        try assertIdentity("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "kept", "count": 3},
          "metadata": {"tags": [], "concepts": []}
        }
        """)
    }

    // MARK: - Asset.FileMetadata decoded directly as a field value

    /// Transformation: a field of Contentful type "Object" shaped exactly like a file metadata
    /// blob decodes to `Asset.FileMetadata` directly — no `Asset`/`Link` wrapper at all
    /// (contentful.swift's generic `[String: Any]` field decoder tries `Asset.FileMetadata`
    /// before falling back to a plain dictionary), and its protocol-relative URL gets an
    /// explicit scheme, same as a resolved asset link's `file` field. This is distinct from
    /// `testResolvedAssetLinkMapsDescriptionContentTypeSizeAndImageDimensions`, which covers the
    /// same shape arriving through a resolved asset *link* instead.
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

        let result = try CTEntry(entry).toJSON()

        try assertJSONEqual("""
        {
          "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"rawFile": {"fileName": "raw.png", "contentType": "image/png",
                       "details": {"size": 512, "image": {"width": 100, "height": 50}},
                       "url": "https://images.ctfassets.net/raw.png"}},
          "metadata": {"tags": [], "concepts": []}
        }
        """, result)
    }

    // MARK: - Reading a resolved entry

    func testGetFieldReturnsValueForMatchingType() {
        let resolved = CTEntry(any: [
            "sys": ["id": "e1"],
            "fields": ["title": "Hello", "count": 3.0, "isFeatured": true],
        ])

        XCTAssertEqual(resolved.getField("title"), "Hello")
        // `JSONValue.number` has no separate Int case — an Int field round-trips as Double.
        XCTAssertEqual(resolved.getField("count"), 3.0)
        XCTAssertEqual(resolved.getField("isFeatured"), true)
    }

    func testGetFieldReturnsNilForWrongRequestedType() {
        // "count" is a Double in the raw map; requesting it as String must fail the `as?` cast
        // and return nil, not crash or coerce.
        let resolved = CTEntry(any: ["sys": [:], "fields": ["count": 3.0]])

        let asString: String? = resolved.getField("count")
        XCTAssertNil(asString)
    }

    func testGetFieldReturnsNilForAbsentField() {
        let resolved = CTEntry(any: ["sys": [:], "fields": ["title": "Hello"]])

        let missing: String? = resolved.getField("subtitle")
        XCTAssertNil(missing)
    }

    func testGetFieldReturnsNilWhenFieldsKeyIsAbsent() {
        // No "fields" key at all — e.g. a malformed or partial resolver output.
        let resolved = CTEntry(any: ["sys": ["id": "e1"]])

        let value: String? = resolved.getField("title")
        XCTAssertNil(value)
    }

    func testHasFieldReturnsTrueForPresentFieldRegardlessOfValueType() {
        let resolved = CTEntry(any: ["sys": [:], "fields": ["nt_experiences": NSNull()]])

        XCTAssertTrue(resolved.hasField("nt_experiences"))
    }

    func testHasFieldReturnsFalseForAbsentField() {
        let resolved = CTEntry(any: ["sys": [:], "fields": ["title": "Hello"]])

        XCTAssertFalse(resolved.hasField("nt_experiences"))
    }

    func testHasFieldReturnsFalseWhenFieldsKeyIsAbsent() {
        let resolved = CTEntry(any: ["sys": ["id": "e1"]])

        XCTAssertFalse(resolved.hasField("nt_experiences"))
    }

    func testIdReturnsSysId() {
        let resolved = CTEntry(any: ["sys": ["id": "e1"], "fields": [:]])

        XCTAssertEqual(resolved.id, "e1")
    }

    func testIdReturnsNilWhenSysKeyIsAbsent() {
        let resolved = CTEntry(any: ["fields": ["title": "Hello"]])

        XCTAssertNil(resolved.id)
    }

    func testIdReturnsNilWhenSysIdIsWrongType() {
        // "id" present but not a String — e.g. accidentally passed a number.
        let resolved = CTEntry(any: ["sys": ["id": 123.0], "fields": [:]])

        XCTAssertNil(resolved.id)
    }

    func testContentTypeIdReturnsNestedContentTypeId() {
        let resolved = CTEntry(any: [
            "sys": [
                "contentType": [
                    "sys": ["id": "landingPage", "type": "Link", "linkType": "ContentType"],
                ],
            ],
            "fields": [:],
        ])

        XCTAssertEqual(resolved.contentTypeId, "landingPage")
    }

    func testContentTypeIdReturnsNilWhenAbsent() {
        let resolved = CTEntry(any: ["sys": ["id": "e1"], "fields": [:]])

        XCTAssertNil(resolved.contentTypeId)
    }

    // MARK: - localeCode mirrors Entry.localeCode

    func testLocaleCodeReturnsSysLocale() {
        let resolved = CTEntry(any: ["sys": ["id": "e1", "locale": "en-US"], "fields": [:]])

        XCTAssertEqual(resolved.localeCode, "en-US")
    }

    func testLocaleCodeReturnsNilWhenAbsent() {
        // Absent on a raw CDA response fetched via /sync or the wildcard `locale=*` query —
        // same case where `Entry.localeCode` itself returns nil.
        let resolved = CTEntry(any: ["sys": ["id": "e1"], "fields": [:]])

        XCTAssertNil(resolved.localeCode)
    }

    // MARK: - createdAt/updatedAt mirror Entry.createdAt/updatedAt

    func testCreatedAtAndUpdatedAtParseISO8601SysTimestamps() {
        let resolved = CTEntry(any: [
            "sys": ["id": "e1", "createdAt": "2024-01-01T00:00:00Z", "updatedAt": "2024-06-15T12:30:00Z"],
            "fields": [:],
        ])

        XCTAssertNotNil(resolved.createdAt)
        XCTAssertNotNil(resolved.updatedAt)
        XCTAssertNotEqual(resolved.createdAt, resolved.updatedAt)
    }

    func testCreatedAtAndUpdatedAtReturnNilWhenAbsent() {
        // A resolver-synthesized entry may carry no creation/update timestamps — same as
        // `Entry.createdAt`/`updatedAt` returning nil for a resource fetched without `sys` dates.
        let resolved = CTEntry(any: ["sys": ["id": "e1"], "fields": [:]])

        XCTAssertNil(resolved.createdAt)
        XCTAssertNil(resolved.updatedAt)
    }

    func testCreatedAtReturnsNilForUnparseableTimestamp() {
        let resolved = CTEntry(any: ["sys": ["id": "e1", "createdAt": "not-a-date"], "fields": [:]])

        XCTAssertNil(resolved.createdAt)
    }

    // MARK: - String field subscript mirrors Entry's convenience subscript

    func testStringFieldSubscriptReadsFromFields() {
        let resolved = CTEntry(any: ["sys": [:], "fields": ["title": "Hello"]])

        let title: String? = resolved[field: "title"]
        XCTAssertEqual(title, "Hello")
    }

    func testStringFieldSubscriptReturnsNilForWrongType() {
        let resolved = CTEntry(any: ["sys": [:], "fields": ["count": 3.0]])

        let asString: String? = resolved[field: "count"]
        XCTAssertNil(asString)
    }

    // MARK: - init(any:fallback:) falls back on unsupported Foundation types

    /// `Date`/`Data`/other non-JSON-safe Foundation values have no case `init(any:fallback:)`
    /// handles — a caller passing one gets `fallback` (`.empty` by default), not a value that
    /// quietly reads back as absent.
    func testInitAnyFallsBackForUnsupportedType() {
        let resolved = CTEntry(any: ["fields": ["publishedAt": Date()]])

        XCTAssertNil(resolved.id)
        let value: String? = resolved.getField("publishedAt")
        XCTAssertNil(value)
    }

    func testInitAnyUsesProvidedFallbackForUnsupportedType() {
        let fallback = CTEntry(any: ["sys": ["id": "fallback-id"], "fields": [:]])
        let resolved = CTEntry(any: ["fields": ["publishedAt": Date()]], fallback: fallback)

        XCTAssertEqual(resolved.id, "fallback-id")
    }
}
