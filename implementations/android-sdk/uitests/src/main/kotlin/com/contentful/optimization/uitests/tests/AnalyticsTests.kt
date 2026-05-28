package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.CiSkip
import com.contentful.optimization.uitests.support.PerTestRule
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AnalyticsTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        AppLauncher.launchApp(device)
        clearProfileState(device)
    }

    @Test
    fun testTracksEntryViewEventsForVisibleEntries() {
        CiSkip.skipOnCi(
            "ViewTrackingController dwell timing is covered deterministically by ViewTrackingControllerTest " +
                "(packages/android/.../tracking/) — this E2E variant races the scroll-during-dwell threshold on the " +
                "x86_64 CI emulator.",
        )
        // Step 1: Wait until the "Analytics Events" text is visible.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Step 2: Wait until the recorded Insights API event count is at least 1.
        TestHelpers.waitForEventsCountAtLeast(device, 1, timeout = TestHelpers.ELEMENT_TIMEOUT)

        // Step 3: Scroll main-scroll-view until the per-entry stats element for the merge tag
        // entry becomes visible. Android exposes this as "component-stats-<entryId>" (vs
        // "entry-stats-<entryId>" on iOS) because the Compose testTag uses that prefix.
        val statsId = "component-stats-1MwiFl4z7gkwqGYdvCmr8c"
        TestHelpers.scrollToElement(device, statsId, "main-scroll-view")
        TestHelpers.waitForElement(device, By.res(statsId), TestHelpers.ELEMENT_TIMEOUT)
    }
}
