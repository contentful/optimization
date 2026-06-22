package com.contentful.optimization.tracking

internal class ScreenTrackingState {
    private var lastAcceptedScreenName: String? = null
    private var inFlightScreenName: String? = null

    fun shouldTrack(screenName: String, trackingAllowed: Boolean): Boolean {
        return trackingAllowed &&
            lastAcceptedScreenName != screenName &&
            inFlightScreenName != screenName
    }

    fun markInFlight(screenName: String) {
        inFlightScreenName = screenName
    }

    fun markAccepted(screenName: String) {
        lastAcceptedScreenName = screenName
    }

    fun clearInFlight(screenName: String) {
        if (inFlightScreenName == screenName) {
            inFlightScreenName = null
        }
    }

    fun reset() {
        lastAcceptedScreenName = null
        inFlightScreenName = null
    }
}
