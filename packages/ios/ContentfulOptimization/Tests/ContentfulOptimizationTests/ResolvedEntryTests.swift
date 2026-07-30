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
}
