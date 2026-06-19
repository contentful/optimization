package com.contentful.optimization.compose

import com.contentful.optimization.tracking.ScreenTrackingState
import org.junit.Assert.assertEquals
import org.junit.Test

class ScreenTrackingStateTest {

    @Test
    fun `tracks current screen once when tracking becomes allowed`() {
        val state = ScreenTrackingState()

        assertEquals(false, state.shouldTrack("Home", trackingAllowed = false))
        assertEquals(true, state.shouldTrack("Home", trackingAllowed = true))

        state.markAccepted("Home")

        assertEquals(false, state.shouldTrack("Home", trackingAllowed = false))
        assertEquals(false, state.shouldTrack("Home", trackingAllowed = true))
    }

    @Test
    fun `does not duplicate an in-flight screen`() {
        val state = ScreenTrackingState()

        assertEquals(true, state.shouldTrack("Home", trackingAllowed = true))

        state.markInFlight("Home")

        assertEquals(false, state.shouldTrack("Home", trackingAllowed = true))

        state.clearInFlight("Home")

        assertEquals(true, state.shouldTrack("Home", trackingAllowed = true))
    }

    @Test
    fun `tracks changed screens after an accepted screen`() {
        val state = ScreenTrackingState()

        state.markAccepted("Home")

        assertEquals(true, state.shouldTrack("Details", trackingAllowed = true))
    }
}
