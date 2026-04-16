import Foundation
import os

/// Lightweight diagnostic logger for the Optimization SDK.
///
/// When enabled via `OptimizationConfig(debug: true)`, logs are emitted
/// through `os.Logger` under the `com.contentful.optimization` subsystem.
/// All output is visible in Xcode console and Console.app.
///
/// When disabled, all calls are no-ops — `@autoclosure` parameters ensure
/// string interpolation is deferred until after the enabled check.
final class DiagnosticLogger: @unchecked Sendable {
    static let shared = DiagnosticLogger()

    private let lock = NSLock()
    private var _enabled = false
    private let logger = os.Logger(
        subsystem: "com.contentful.optimization",
        category: "Diagnostics"
    )

    private init() {}

    func setEnabled(_ enabled: Bool) {
        lock.lock()
        _enabled = enabled
        lock.unlock()
    }

    private var isEnabled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _enabled
    }

    // MARK: - Logging

    func debug(_ message: @autoclosure () -> String) {
        guard isEnabled else { return }
        let msg = message()
        logger.debug("\(msg, privacy: .public)")
    }

    func info(_ message: @autoclosure () -> String) {
        guard isEnabled else { return }
        let msg = message()
        logger.info("\(msg, privacy: .public)")
    }

    func warning(_ message: @autoclosure () -> String) {
        guard isEnabled else { return }
        let msg = message()
        logger.warning("\(msg, privacy: .public)")
    }

    func error(_ message: @autoclosure () -> String) {
        guard isEnabled else { return }
        let msg = message()
        logger.error("\(msg, privacy: .public)")
    }
}
