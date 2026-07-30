@testable import ContentfulOptimization
import XCTest

/// Direct unit tests for `ResolvedEntry` in isolation — the happy path is already exercised
/// indirectly through `OptimizedEntryContentfulInitTests`, but the absent/wrong-type cases (a
/// resolver output missing `sys`/`fields`, or a field read back as the wrong type) have no
/// coverage anywhere else.
final class ResolvedEntryTests: XCTestCase {
    func testGetFieldReturnsValueForMatchingType() {
        let resolved = ResolvedEntry([
            "sys": ["id": "e1"],
            "fields": ["title": "Hello", "count": 3, "isFeatured": true],
        ])

        XCTAssertEqual(resolved.getField("title"), "Hello")
        XCTAssertEqual(resolved.getField("count"), 3)
        XCTAssertEqual(resolved.getField("isFeatured"), true)
    }

    func testGetFieldReturnsNilForWrongRequestedType() {
        // "count" is an Int in the raw map; requesting it as String must fail the `as?` cast and
        // return nil, not crash or coerce.
        let resolved = ResolvedEntry(["sys": [:], "fields": ["count": 3]])

        let asString: String? = resolved.getField("count")
        XCTAssertNil(asString)
    }

    func testGetFieldReturnsNilForAbsentField() {
        let resolved = ResolvedEntry(["sys": [:], "fields": ["title": "Hello"]])

        let missing: String? = resolved.getField("subtitle")
        XCTAssertNil(missing)
    }

    func testGetFieldReturnsNilWhenFieldsKeyIsAbsent() {
        // No "fields" key at all — e.g. a malformed or partial resolver output.
        let resolved = ResolvedEntry(["sys": ["id": "e1"]])

        let value: String? = resolved.getField("title")
        XCTAssertNil(value)
    }

    func testIdReturnsSysId() {
        let resolved = ResolvedEntry(["sys": ["id": "e1"], "fields": [:]])

        XCTAssertEqual(resolved.id, "e1")
    }

    func testIdReturnsNilWhenSysKeyIsAbsent() {
        let resolved = ResolvedEntry(["fields": ["title": "Hello"]])

        XCTAssertNil(resolved.id)
    }

    func testIdReturnsNilWhenSysIdIsWrongType() {
        // "id" present but not a String — e.g. accidentally passed a number.
        let resolved = ResolvedEntry(["sys": ["id": 123], "fields": [:]])

        XCTAssertNil(resolved.id)
    }

    // MARK: - localeCode mirrors Entry.localeCode

    func testLocaleCodeReturnsSysLocale() {
        let resolved = ResolvedEntry(["sys": ["id": "e1", "locale": "en-US"], "fields": [:]])

        XCTAssertEqual(resolved.localeCode, "en-US")
    }

    func testLocaleCodeReturnsNilWhenAbsent() {
        // Absent on a raw CDA response fetched via /sync or the wildcard `locale=*` query —
        // same case where `Entry.localeCode` itself returns nil.
        let resolved = ResolvedEntry(["sys": ["id": "e1"], "fields": [:]])

        XCTAssertNil(resolved.localeCode)
    }

    // MARK: - createdAt/updatedAt mirror Entry.createdAt/updatedAt

    func testCreatedAtAndUpdatedAtParseISO8601SysTimestamps() {
        let resolved = ResolvedEntry([
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
        let resolved = ResolvedEntry(["sys": ["id": "e1"], "fields": [:]])

        XCTAssertNil(resolved.createdAt)
        XCTAssertNil(resolved.updatedAt)
    }

    func testCreatedAtReturnsNilForUnparseableTimestamp() {
        let resolved = ResolvedEntry(["sys": ["id": "e1", "createdAt": "not-a-date"], "fields": [:]])

        XCTAssertNil(resolved.createdAt)
    }

    // MARK: - String/Int subscripts mirror Entry's convenience subscripts

    func testStringSubscriptReadsFromFields() {
        let resolved = ResolvedEntry(["sys": [:], "fields": ["title": "Hello"]])

        let title: String? = resolved["title"]
        XCTAssertEqual(title, "Hello")
    }

    func testIntSubscriptReadsFromFields() {
        let resolved = ResolvedEntry(["sys": [:], "fields": ["count": 3]])

        let count: Int? = resolved["count"]
        XCTAssertEqual(count, 3)
    }

    func testStringSubscriptReturnsNilForWrongType() {
        let resolved = ResolvedEntry(["sys": [:], "fields": ["count": 3]])

        let asString: String? = resolved["count"]
        XCTAssertNil(asString)
    }
}
