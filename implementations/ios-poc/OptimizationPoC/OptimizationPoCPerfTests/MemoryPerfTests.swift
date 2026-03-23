import XCTest
import JavaScriptCore

/// Performance tests measuring memory overhead of the JS SDK bridge.
final class MemoryPerfTests: XCTestCase {

    override func setUp() {
        super.setUp()
        StubURLProtocol.register()
    }

    override func tearDown() {
        StubURLProtocol.unregister()
        super.tearDown()
    }

    /// Measures memory delta from creating one fully initialized JSContext.
    func testJSContextMemoryFootprint() {
        let options = XCTMeasureOptions()
        options.iterationCount = 5

        measure(metrics: [XCTMemoryMetric()], options: options) {
            let manager = PerfTestJSContextManager(stubFetch: true)
            manager.initialize()
            XCTAssertTrue(manager.isInitialized)
            // Keep the context alive through the measurement
            _ = manager.getProfile()
            manager.destroy()
        }
    }

    /// Measures memory growth after 100 identify + page calls.
    /// Asserts that growth stays under 15MB.
    func testMemoryGrowthUnderLoad() {
        let manager = PerfTestJSContextManager(stubFetch: true)
        manager.initialize()
        XCTAssertTrue(manager.isInitialized, "SDK must be initialized before load test")

        guard let baselineMemory = MemoryReporter.physicalFootprint() else {
            XCTFail("Failed to read baseline memory footprint")
            return
        }
        let baselineMB = Double(baselineMemory) / (1024 * 1024)
        print("PERF_RESULT:{\"test\":\"memoryGrowthUnderLoad\",\"baselineMemoryMB\":\(baselineMB)}")

        for i in 0..<100 {
            _ = manager.identifySynchronously(userId: "perf-user-\(i)")
            _ = manager.pageSynchronously()
        }

        guard let finalMemory = MemoryReporter.physicalFootprint() else {
            XCTFail("Failed to read final memory footprint")
            return
        }
        let finalMB = Double(finalMemory) / (1024 * 1024)
        let growthMB = finalMB - baselineMB

        print("PERF_RESULT:{\"test\":\"memoryGrowthUnderLoad\",\"finalMemoryMB\":\(finalMB),\"growthMB\":\(growthMB)}")

        XCTAssertLessThan(growthMB, 15.0, "Memory growth should be less than 15MB over 100 operations (actual: \(String(format: "%.2f", growthMB)) MB)")

        manager.destroy()
    }
}
