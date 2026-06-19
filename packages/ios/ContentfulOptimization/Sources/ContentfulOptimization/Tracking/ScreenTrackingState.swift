struct ScreenTrackingState {
    private var lastAcceptedScreenName: String?
    private var inFlightScreenName: String?

    func shouldTrack(_ screenName: String, trackingAllowed: Bool) -> Bool {
        trackingAllowed &&
            lastAcceptedScreenName != screenName &&
            inFlightScreenName != screenName
    }

    mutating func markInFlight(_ screenName: String) {
        inFlightScreenName = screenName
    }

    mutating func markAccepted(_ screenName: String) {
        lastAcceptedScreenName = screenName
    }

    mutating func clearInFlight(_ screenName: String) {
        if inFlightScreenName == screenName {
            inFlightScreenName = nil
        }
    }

    mutating func reset() {
        lastAcceptedScreenName = nil
        inFlightScreenName = nil
    }
}
