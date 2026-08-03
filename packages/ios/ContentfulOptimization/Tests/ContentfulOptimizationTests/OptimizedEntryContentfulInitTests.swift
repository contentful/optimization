@testable import Contentful
@testable import ContentfulOptimization
import Foundation
import SwiftUI
import XCTest

/// Tests `OptimizedEntry` itself at the `Contentful.Entry` initializer boundary — not the
/// standalone `CTEntry(_: Contentful.Entry)` function, but that the initializer actually wires
/// the mapped dict into the stored `entry` property and wraps the caller's
/// `(CTEntry) -> Content` closure into the stored `([String: Any]) -> Content`
/// shape `body` calls. Both `entry` and `content` are internal (no access modifier), so
/// `@testable import` reaches them directly — no rendering harness or `OptimizationClient`
/// environment needed for this layer.
final class OptimizedEntryContentfulInitTests: XCTestCase {
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

    private static let sampleJSON = """
    {
      "sys": {"id": "e1", "type": "Entry", "locale": "en-US",
               "contentType": {"sys": {"id": "landingPage", "type": "Link", "linkType": "ContentType"}}},
      "fields": {"title": "Hello"}
    }
    """

    // `Entry` is a class — `resolveLinks` (exercised in the sibling mapper test file) mutates it
    // in place, so a decode-once-per-file `static let` would let mutation in one test leak into
    // another regardless of run order. XCTest calls `setUp()` before every test method, which
    // gives each test its own decode without repeating the boilerplate at every call site.
    private var entry: Entry!

    override func setUpWithError() throws {
        try super.setUpWithError()
        entry = try decodeEntry(Self.sampleJSON)
    }

    override func tearDown() {
        entry = nil
        super.tearDown()
    }

    // MARK: - The initializer stores the mapped dict, not the raw Entry

    func testContentfulInitializerStoresMappedDictAsEntry() throws {
        let sut = OptimizedEntry(entry: entry) { (_: CTEntry) in EmptyView() }

        XCTAssertEqual(
            NSDictionary(dictionary: sut.entry.toDictionary()),
            NSDictionary(dictionary: CTEntry(entry).toDictionary())
        )
        XCTAssertEqual(sut.entry.id, "e1")
        let dict = sut.entry.toDictionary()
        XCTAssertNotNil(dict["metadata"], "the always-present metadata guarantee must hold through the initializer, not just the mapper")
    }

    // MARK: - The stored `content` closure forwards its actual argument, not the captured baseline entry

    func testStoredContentClosureForwardsResolvedVariantNotCapturedBaselineEntry() throws {
        var received: CTEntry?

        func makeContent(for resolved: CTEntry) -> SwiftUI.Text {
            received = resolved
            return SwiftUI.Text("rendered")
        }

        let sut = OptimizedEntry(entry: entry, content: makeContent)

        // Deliberately distinct from `entry`'s own id/title ("e1"/"Hello"), and fed through
        // `sut.content` rather than reused from `CTEntry(_: Contentful.Entry)`. At runtime
        // `body` calls the stored `content` with `result.entry` — the *resolved variant* a live
        // OptimizationClient hands back, which for a personalized entry can genuinely differ from
        // the baseline stored in `sut.entry`. A distinguishing value here is what actually proves
        // the closure forwards its argument: if the wrapping closure had a bug like
        // `{ _ in content(CTEntry(entry)) }` — ignoring its parameter and
        // re-deriving from the captured baseline entry instead — a same-shaped stand-in would pass
        // by coincidence and this bug would go undetected.
        let resolverOutput: [String: Any] = [
            "sys": ["id": "resolved-1"],
            "fields": ["title": "Resolved Title"],
        ]
        _ = sut.content(resolverOutput)

        XCTAssertEqual(received?.id, "resolved-1")
        XCTAssertEqual(received?.getField("title"), "Resolved Title")
    }

    // MARK: - Both initializers can coexist on the same generic Content type

    func testDictAndContentfulInitializersProduceSameGenericContentType() throws {
        // If this compiles, Swift resolved both initializers to `OptimizedEntry<Text>` — the
        // point of keeping a single generic parameter rather than adding a second one for
        // `Resolved`. A type mismatch here would be a compile error, not a runtime failure.
        let fromDict: OptimizedEntry<SwiftUI.Text> = OptimizedEntry(entry: ["sys": ["id": "x"], "fields": [:]]) { _ in
            SwiftUI.Text("dict")
        }
        let fromEntry: OptimizedEntry<SwiftUI.Text> = OptimizedEntry(entry: entry) { (_: CTEntry) in
            SwiftUI.Text("entry")
        }

        XCTAssertEqual(fromDict.entry.id, "x")
        XCTAssertEqual(fromEntry.entry.id, "e1")
    }

    // MARK: - Non-optimized entries: the Contentful.Entry initializer still round-trips through body's baseline path

    func testMappedEntryWithoutExperiencesFieldIsTreatedAsNonOptimized() throws {
        // No `nt_experiences` field — `isOptimized` (OptimizedEntry.swift) should be false, and
        // `body` takes the non-optimized branch, but that's an OptimizationClient-dependent path.
        // What's testable without rendering is that the mapped dict itself carries no
        // `nt_experiences` key, which is the input `isOptimized` reads.
        let sut = OptimizedEntry(entry: entry) { (_: CTEntry) in EmptyView() }

        let fields = sut.entry.toDictionary()["fields"] as? [String: Any]
        XCTAssertNil(fields?["nt_experiences"])
    }

    // MARK: - onTap stays dict-typed on both initializers — by design, not by oversight

    /// `onTap` on the `Contentful.Entry` initializer is `(([String: Any]) -> Void)?` — the same
    /// raw-dict shape as the dict-based initializer's `onTap`, *not*
    /// `((CTEntry) -> Void)?` like `content`. This looks like an asymmetry against
    /// `content`'s typed wrapping, but it isn't one: `TapTrackingModifier.body(content:)`
    /// (`Tracking/TapTrackingModifier.swift`) calls `onTap?(entry)` with the view's *baseline*
    /// `entry` — never `result.entry`, the resolved variant `content` receives — on both
    /// initializers equally. `onTap` reports which baseline entry was tapped, for tracking;
    /// `content` renders the resolved variant, for display. Different roles, so no
    /// `CTEntry` wrapping applies to `onTap` on either initializer. This test pins
    /// that down so a future change to `onTap`'s type is a deliberate decision, not a silent
    /// regression.
    func testOnTapReceivesBaselineDictOnContentfulInitializerNotResolvedEntry() throws {
        var receivedOnTapArgument: [String: Any]?

        let sut = OptimizedEntry(
            entry: entry,
            onTap: { raw in receivedOnTapArgument = raw },
            content: { (_: CTEntry) in EmptyView() }
        )

        // Exercises the same call `TapTrackingModifier` makes: `onTap?(entry)`, with the view's
        // own stored baseline `entry` (`sut.entry`) — not a resolved variant.
        sut.onTap?(sut.entry.toDictionary())

        XCTAssertEqual((receivedOnTapArgument?["sys"] as? [String: Any])?["id"] as? String, "e1")
    }
}
