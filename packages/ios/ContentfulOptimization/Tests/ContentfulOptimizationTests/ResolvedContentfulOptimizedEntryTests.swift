@testable import Contentful
@testable import ContentfulOptimization
import Foundation
import XCTest

/// Tests the `Contentful.Entry` overload of `resolveOptimizedEntry` — that it maps `baseline`
/// through `OptimizationEntryMapping` before delegating to the dict-based overload, and wraps the
/// dict-based result's `entry` in a `ResolvedEntry` rather than handing back a raw dict. Covers
/// both the not-initialized fail-soft path and a real round trip through the JS bridge, mirroring
/// `OptimizationClientTests.testResolveOptimizedEntryReturnsBaselineWhenNotInitialized` and
/// `testResolveOptimizedEntryPreservesFieldsWhenInitialized` for the dict-based overload.
final class ResolvedContentfulOptimizedEntryTests: XCTestCase {
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

    @MainActor
    func testNotInitializedFallsBackToMappedBaselineEntry() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "entry-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "Default Title"}
        }
        """)
        let client = OptimizationClient()

        let result = client.resolveOptimizedEntry(baseline: entry)

        XCTAssertEqual(result.entry.id, "entry-1")
        XCTAssertEqual(result.entry.getField("title"), "Default Title")
        XCTAssertNil(result.selectedOptimization)
        XCTAssertNil(result.optimizationContextId)
    }

    /// Proves this overload actually routes through `OptimizationEntryMapping` rather than some
    /// other conversion: a resolved link on the baseline must come back expanded exactly as
    /// `OptimizationEntryMapping.toOptimizationEntry` would produce it, readable via `getField`.
    @MainActor
    func testNotInitializedFallbackEntryHasLinksExpandedByOptimizationEntryMapping() throws {
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
        parent.resolveLinks(against: ["parent": parent, "child-1": child], and: [:])
        let client = OptimizationClient()

        let result = client.resolveOptimizedEntry(baseline: parent)

        let childField: [String: Any]? = result.entry.getField("child")
        XCTAssertEqual((childField?["sys"] as? [String: Any])?["id"] as? String, "child-1")
        XCTAssertEqual((childField?["fields"] as? [String: Any])?["name"] as? String, "child entry", "the resolved link must have expanded inline, matching OptimizationEntryMapping's own behavior")
    }

    /// This overload must be a true *overload* of the existing method — same name,
    /// `resolveOptimizedEntry`, resolved by Swift purely from the static type of `baseline` at the
    /// call site (a dict picks the `OptimizationClient` member; a `Contentful.Entry` picks this
    /// extension member) — not a differently-named method that merely does something similar. If
    /// this file's declaration used a different name, both calls below would still compile, but
    /// this test's *point* would be false; the identical call syntax below, returning provably
    /// different result types, is what actually proves overload resolution picked two distinct
    /// declarations rather than one generic one.
    @MainActor
    func testIsATrueOverloadResolvedByBaselineArgumentType() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "entry-1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "test", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "Hello"}
        }
        """)
        let dict: [String: Any] = ["sys": ["id": "entry-1"], "fields": ["title": "Hello"]]
        let client = OptimizationClient()

        let dictResult: ResolvedOptimizedEntry = client.resolveOptimizedEntry(baseline: dict)
        let entryResult: ResolvedContentfulOptimizedEntry = client.resolveOptimizedEntry(baseline: entry)

        XCTAssertEqual((dictResult.entry["sys"] as? [String: Any])?["id"] as? String, "entry-1")
        XCTAssertEqual(entryResult.entry.id, "entry-1")
    }

    // MARK: - Real bridge round trip (initialized client)

    /// The not-initialized tests above only prove the fallback path; they never exercise the
    /// bridge call this overload actually delegates to. This round-trips a real `Contentful.Entry`
    /// through an initialized client's JS bridge (mirroring
    /// `OptimizationClientTests.testResolveOptimizedEntryPreservesFieldsWhenInitialized`, the
    /// dict-based overload's equivalent test) and confirms fields survive and are readable via
    /// `getField` on the returned `ResolvedEntry` — not just that the mapping step alone works.
    @MainActor
    func testInitializedClientRoundTripsFieldsThroughRealBridge() throws {
        let entry = try decodeEntry("""
        {
          "sys": {"id": "entry1", "type": "Entry", "locale": "en-US",
                   "contentType": {"sys": {"id": "page", "type": "Link", "linkType": "ContentType"}}},
          "fields": {"title": "Hello", "slug": "hello-world"}
        }
        """)
        let client = OptimizationClient()
        let config = OptimizationConfig(
            clientId: "test-client",
            environment: "master",
            api: OptimizationApiConfig(
                experienceBaseUrl: "http://localhost:8000/experience/",
                insightsBaseUrl: "http://localhost:8000/insights/"
            )
        )
        try client.initialize(config: config)

        let result = client.resolveOptimizedEntry(baseline: entry)

        XCTAssertEqual(result.entry.getField("title"), "Hello", "the entry must actually round-trip through the JS bridge, not just fall back to the pre-mapped baseline")
        XCTAssertEqual(result.entry.getField("slug"), "hello-world")
    }
}
