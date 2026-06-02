package com.contentful.optimization.shared

import com.contentful.optimization.core.ContentfulLocales

object AppConfig {
    const val defaultContentfulLocale = "en-US"
    const val clientId = "mock-client-id"
    const val environment = "master"

    // The mock API server runs on the HOST machine. From inside an Android
    // emulator, `localhost`/`127.0.0.1` is the emulator's OWN loopback, not the
    // host — reaching the host that way requires an `adb reverse tcp:8000`
    // forward. That forward is NOT persistent: any `adbd`/adb-server restart
    // (common on loaded CI emulators, and observed mid-run on the Namespace
    // x86_64 runner) silently drops it, after which every host call fails with
    // "Connection refused". Navigation flows survived; everything that resolves
    // content over the network did not. `10.0.2.2` is the emulator's stable,
    // built-in alias for the host loopback and needs no adb forward, so it is
    // immune to that churn on every architecture (arm64 locally, x86_64 in CI).
    const val mockHost = "http://10.0.2.2:8000"
    const val experienceBaseUrl = "$mockHost/experience/"
    const val insightsBaseUrl = "$mockHost/insights/"

    const val contentfulBaseUrl = "$mockHost/contentful/"
    const val contentfulSpaceId = "mock-space-id"
    val contentfulLocales = ContentfulLocales(default = defaultContentfulLocale)

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
