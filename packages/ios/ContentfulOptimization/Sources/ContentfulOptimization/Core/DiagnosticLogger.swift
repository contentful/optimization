import Foundation
import os

/// Lightweight diagnostic logger for the Optimization SDK.
///
/// Logs at or above `OptimizationConfig.logLevel` are emitted
/// through `os.Logger` under the `com.contentful.optimization` subsystem.
/// All output is visible in Xcode console and Console.app.
final class DiagnosticLogger: @unchecked Sendable {
    static let shared = DiagnosticLogger()

    private let lock = NSLock()
    private var level: OptimizationLogLevel = .error
    private let logger = os.Logger(
        subsystem: "com.contentful.optimization",
        category: "Diagnostics"
    )

    private init() {}

    func setLevel(_ level: OptimizationLogLevel) {
        lock.lock()
        self.level = level
        lock.unlock()
    }

    private func allows(_ candidate: OptimizationLogLevel) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return candidate.severity >= level.severity
    }

    // MARK: - Logging

    func debug(_ message: @autoclosure () -> String) {
        guard allows(.debug) else { return }
        let msg = message()
        logger.debug("\(msg, privacy: .public)")
    }

    func info(_ message: @autoclosure () -> String) {
        guard allows(.info) else { return }
        let msg = message()
        logger.info("\(msg, privacy: .public)")
    }

    func warning(_ message: @autoclosure () -> String) {
        guard allows(.warn) else { return }
        let msg = message()
        logger.warning("\(msg, privacy: .public)")
    }

    func error(_ message: @autoclosure () -> String) {
        guard allows(.error) else { return }
        let msg = message()
        logger.error("\(msg, privacy: .public)")
    }
}

private extension OptimizationLogLevel {
    var severity: Int {
        switch self {
        case .fatal:
            60
        case .error:
            50
        case .warn:
            40
        case .info:
            30
        case .debug:
            20
        case .log:
            10
        }
    }
}
