package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.CiSkip
import com.contentful.optimization.uitests.support.PerTestRule
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.RunWith

/**
 * Flag view tracking. Mirrors the iOS `FlagViewTrackingTests` XCUITest suite:
 * subscribing to the `boolean` flag on app launch must emit a flag-view
 * `component` event counted under `event-count-boolean`.
 */
@RunWith(AndroidJUnit4::class)
class FlagViewTrackingTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        clearProfileState(device, requireFreshAppInstance = true)
    }

    @Test
    fun testEmitsFlagViewEventsForSubscribedBooleanFlag() {
        CiSkip.skipOnCi(
            "Flag-view event count depends on the same 2 s dwell timer covered by ViewTrackingControllerTest.",
        )
        // 1. Wait until the "Analytics Events" text is present.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // 2. Wait until flag `boolean` has at least 1 view event. waitForComponentEventCount
        //    scrolls the analytics stats into view itself.
        TestHelpers.waitForComponentEventCount(device, "boolean", 1, timeout = TestHelpers.ELEMENT_TIMEOUT)
    }
}
