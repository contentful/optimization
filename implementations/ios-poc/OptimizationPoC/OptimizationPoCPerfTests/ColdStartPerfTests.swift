import XCTest
import JavaScriptCore

/// Performance tests measuring cold start time for the JS SDK bridge initialization.
final class ColdStartPerfTests: XCTestCase {

    override func setUp() {
        super.setUp()
        StubURLProtocol.register()
    }

    override func tearDown() {
        StubURLProtocol.unregister()
        super.tearDown()
    }

    /// Measures end-to-end JSContext creation through SDK initialization.
    func testColdStartTotal() {
        let options = XCTMeasureOptions()
        options.iterationCount = 10

        measure(metrics: [XCTClockMetric(), XCTCPUMetric()], options: options) {
            let manager = PerfTestJSContextManager(stubFetch: true)
            manager.initialize()
            XCTAssertTrue(manager.isInitialized, "SDK should be initialized")
            manager.destroy()
        }
    }

    /// Measures per-phase timing breakdown of the initialization process.
    func testColdStartPhaseBreakdown() {
        let options = XCTMeasureOptions()
        options.iterationCount = 5

        var allTimings: [Timings] = []

        measure(options: options) {
            let manager = PerfTestJSContextManager(stubFetch: true)
            let timings = manager.initializeWithTimings()
            allTimings.append(timings)
            XCTAssertTrue(manager.isInitialized, "SDK should be initialized")
            manager.destroy()
        }

        // Output structured results for script extraction
        for (index, timings) in allTimings.enumerated() {
            print("PERF_RESULT:{\"test\":\"coldStartPhaseBreakdown\",\"iteration\":\(index),\"timings\":\(timings.asJSON())}")
        }
    }

    /// Measures 10 init/destroy cycles per iteration to detect degradation over repeated use.
    func testRepeatedInitDestroyCycles() {
        let options = XCTMeasureOptions()
        options.iterationCount = 5

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()], options: options) {
            for _ in 0..<10 {
                let manager = PerfTestJSContextManager(stubFetch: true)
                manager.initialize()
                XCTAssertTrue(manager.isInitialized)
                manager.destroy()
            }
        }
    }
}
