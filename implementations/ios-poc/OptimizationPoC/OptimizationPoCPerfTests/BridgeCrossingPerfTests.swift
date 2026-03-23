import XCTest
import JavaScriptCore

/// Performance tests measuring JS-to-Swift bridge crossing overhead.
final class BridgeCrossingPerfTests: XCTestCase {

    private var manager: PerfTestJSContextManager!

    override func setUp() {
        super.setUp()
        StubURLProtocol.register()
        manager = PerfTestJSContextManager(stubFetch: true)
        manager.initialize()
        XCTAssertTrue(manager.isInitialized, "SDK must be initialized for bridge crossing tests")
    }

    override func tearDown() {
        manager.destroy()
        manager = nil
        StubURLProtocol.unregister()
        super.tearDown()
    }

    /// Measures JS -> Swift -> (stub) -> Swift -> JS round trip for `identify()`.
    /// Uses stubbed `__nativeFetch` to isolate bridge overhead from network latency.
    func testFetchBridgeCrossingLatency() {
        let options = XCTMeasureOptions()
        options.iterationCount = 10

        measure(metrics: [XCTClockMetric()], options: options) {
            let result = manager.identifySynchronously(userId: "perf-user")
            XCTAssertNotNil(result, "identify should return a result")
        }
    }

    /// Measures pure JS evaluate cost via 100x `getProfile()` calls per iteration.
    /// This tests the Swift -> JS -> Swift synchronous bridge path without any async work.
    func testSynchronousBridgeCallLatency() {
        let options = XCTMeasureOptions()
        options.iterationCount = 10

        measure(metrics: [XCTClockMetric()], options: options) {
            for _ in 0..<100 {
                _ = manager.getProfile()
            }
        }
    }
}
