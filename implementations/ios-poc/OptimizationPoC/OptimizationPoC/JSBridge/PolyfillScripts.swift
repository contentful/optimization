import Foundation

/// Loads polyfill JavaScript from `.js` resource files bundled in the app.
/// Scripts are evaluated in `JSContext` before the UMD bundle to provide
/// APIs that JavaScriptCore does not supply natively.
enum PolyfillScripts {

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

    /// All polyfill scripts loaded from `Resources/polyfills/`, in evaluation order.
    /// Crashes at launch if any file is missing — this is intentional so missing
    /// resources surface immediately during development.
    static let all: [String] = fileNames.map { name in
        guard let url = Bundle.main.url(
            forResource: name,
            withExtension: "js",
            subdirectory: "polyfills"
        ) else {
            fatalError("Missing polyfill resource: polyfills/\(name).js")
        }
        do {
            return try String(contentsOf: url, encoding: .utf8)
        } catch {
            fatalError("Failed to read polyfill polyfills/\(name).js: \(error)")
        }
    }
}
