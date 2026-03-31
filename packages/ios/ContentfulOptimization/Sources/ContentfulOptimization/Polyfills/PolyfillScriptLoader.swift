import Foundation

/// Loads polyfill JavaScript from `.js` resource files bundled in the Swift Package.
/// Scripts are evaluated in `JSContext` before the UMD bundle to provide
/// APIs that JavaScriptCore does not supply natively.
enum PolyfillScriptLoader {

    /// Ordered list of polyfill resource filenames (without extension).
    /// Evaluation order matters — e.g. `timers` must precede `abort-controller`.
    private static let fileNames = [
        "console",
        "timers",
        "fetch",
        "crypto",
        "url",
        "abort-controller",
        "promise-utilities",
        "text-encoding",
    ]

    /// Loads all polyfill scripts from the package bundle in evaluation order.
    static func loadAll() throws -> [String] {
        try fileNames.map { name in
            guard let url = Bundle.module.url(
                forResource: name,
                withExtension: "js",
                subdirectory: "polyfills"
            ) else {
                throw OptimizationError.resourceLoadError(
                    "Missing polyfill resource: polyfills/\(name).js"
                )
            }
            do {
                return try String(contentsOf: url, encoding: .utf8)
            } catch {
                throw OptimizationError.resourceLoadError(
                    "Failed to read polyfill polyfills/\(name).js: \(error)"
                )
            }
        }
    }
}
