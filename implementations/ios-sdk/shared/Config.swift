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

    /// Host (with port) for the mock Contentful CDA, in the `host[:port]` form
    /// `Contentful.Client` expects. A production app omits this entirely and
    /// gets the default `cdn.contentful.com`.
    static let contentfulHost = "localhost:8000"

    /// Path prefix the mock server namespaces the CDA under, so one process can
    /// also serve the Experience and Insights APIs. Consumed only by
    /// `ContentfulClient.Transport` — `Contentful.Client` builds paths from the
    /// host root and has nowhere to put a prefix.
    static let contentfulMockPathPrefix = "/contentful"

    static let contentfulSpaceId = "mock-space-id"

    /// The mock CDA ignores authorization, but `Contentful.Client` requires a
    /// token to build its `Authorization` header.
    static let contentfulAccessToken = "mock-access-token"

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
