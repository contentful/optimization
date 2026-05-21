package com.contentful.optimization.app

object AppConfig {
    const val clientId = "mock-client-id"
    const val environment = "master"
    const val experienceBaseUrl = "http://localhost:8000/experience/"
    const val insightsBaseUrl = "http://localhost:8000/insights/"

    const val contentfulBaseUrl = "http://localhost:8000/contentful/"
    const val contentfulSpaceId = "mock-space-id"

    // Minimum height (dp) for a content-entry card, so the home list reliably
    // overflows the viewport and lower entries start below the fold — keeping
    // view-tracking dwell assertions deterministic.
    const val contentEntryMinHeightDp = 180

    val entryIds = listOf(
        "1MwiFl4z7gkwqGYdvCmr8c",
        "4ib0hsHWoSOnCVdDkizE8d",
        "xFwgG3oNaOcjzWiGe4vXo",
        "2Z2WLOx07InSewC3LUB3eX",
        "5XHssysWUDECHzKLzoIsg1",
        "6zqoWXyiSrf0ja7I2WGtYj",
        "7pa5bOx8Z9NmNcr7mISvD",
        "1JAU028vQ7v6nB2swl3NBo",
    )
}
