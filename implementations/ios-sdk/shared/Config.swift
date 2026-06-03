import ContentfulOptimization
import CoreGraphics
import Foundation

struct AppConfig {
    static let defaultContentfulLocale = "en-US"
    static let clientId = "mock-client-id"

    /// Minimum height for each home-screen content entry card. Sized so the
    /// home list is taller than the viewport and the lower entries genuinely
    /// start below the fold — the layout the cross-platform view-tracking
    /// contract assumes for `BELOW_FOLD_ENTRY_ID`.
    static let contentEntryMinHeight: CGFloat = 180
    static let environment = "master"
    static let experienceBaseUrl = "http://localhost:8000/experience/"
    static let insightsBaseUrl = "http://localhost:8000/insights/"

    static let contentfulBaseUrl = "http://localhost:8000/contentful/"
    static let contentfulSpaceId = "mock-space-id"
    static let contentfulLocales = ContentfulLocales(default: defaultContentfulLocale)

    static let entryIds = [
        "1MwiFl4z7gkwqGYdvCmr8c",
        "4ib0hsHWoSOnCVdDkizE8d",
        "xFwgG3oNaOcjzWiGe4vXo",
        "2Z2WLOx07InSewC3LUB3eX",
        "5XHssysWUDECHzKLzoIsg1",
        "6zqoWXyiSrf0ja7I2WGtYj",
        "7pa5bOx8Z9NmNcr7mISvD",
        "1JAU028vQ7v6nB2swl3NBo",
    ]
}
