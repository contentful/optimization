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
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OfflineBehaviorTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    // Time allowed after reconnecting for the SDK online signal to flip and the
    // resulting Experience API queue flush to land before the app is terminated.
    private val QUEUE_FLUSH_GRACE_MS = 10_000L

    // Time allowed after an online identify for the Experience upsert round-trip
    // to complete before the app is terminated.
    private val IDENTIFY_SETTLE_MS = 3_000L

    // Timeout for the post-relaunch variant assertions, generous enough for a
    // cold start to boot, fetch entries, and run resolution.
    private val POST_RELAUNCH_TIMEOUT = 30_000L

    // Nested level-0 entry id that only appears once the SDK resolves the
    // identified profile.
    private val NESTED_VARIANT_TEST_ID = "entry-text-2KIWllNZJT205BwOSkMINg"

    // Nested level-0 entry id that only appears for an anonymous profile.
    private val NESTED_BASELINE_TEST_ID = "entry-text-1JAU028vQ7v6nB2swl3NBo"

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        // beforeEach: restore network first so the device starts each test online,
        // then relaunch from clean storage so the next test starts from a true
        // anonymous profile (requireFreshAppInstance = true).
        enableNetwork()
        AppLauncher.launchApp(device)
        clearProfileState(device, requireFreshAppInstance = true)
    }

    @After
    fun tearDown() {
        // afterEach: always restore network so subsequent tests are not affected.
        enableNetwork()
    }

    // ---------------------------------------------------------------------------
    // Network helpers — implement disableNetwork / enableNetwork via airplane mode
    // shell commands, mirroring the pseudocode network-helpers contract.
    // ---------------------------------------------------------------------------

    private fun disableNetwork() {
        if (isAirplaneModeEnabled()) return
        device.executeShellCommand("cmd connectivity airplane-mode enable")
        waitForAirplaneModeState(expectedEnabled = true)
    }

    private fun enableNetwork() {
        if (!isAirplaneModeEnabled()) return
        device.executeShellCommand("cmd connectivity airplane-mode disable")
        waitForAirplaneModeState(expectedEnabled = false)
    }

    private fun isAirplaneModeEnabled(): Boolean {
        val result = device.executeShellCommand(
            "settings get global airplane_mode_on",
        ).trim()
        return result == "1"
    }

    private fun waitForAirplaneModeState(
        expectedEnabled: Boolean,
        timeoutMs: Long = 3_000L,
        pollMs: Long = 200L,
    ): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (isAirplaneModeEnabled() == expectedEnabled) return true
            Thread.sleep(pollMs)
        }
        // Fallback backoff if the transition could not be confirmed.
        Thread.sleep(if (expectedEnabled) 300L else 500L)
        return false
    }

    // ---------------------------------------------------------------------------
    // Local helpers
    // ---------------------------------------------------------------------------

    private fun getEventsCount(): Int =
        TestHelpers.parseEventsCount(TestHelpers.getElementTextById(device, "events-count"))

    // ---------------------------------------------------------------------------
    // Tests
    // ---------------------------------------------------------------------------

    @Test
    fun testContinuesToTrackEventsWhileOffline() {
        CiSkip.skipOnCi(
            "Asserts on `events-count` whose minimum threshold requires the same dwell-fired component events " +
                "covered by ViewTrackingControllerTest.",
        )
        // Step 1: wait until "Analytics Events" label is visible.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        // Step 2: wait until at least 1 event has been tracked.
        TestHelpers.waitForEventsCountAtLeast(device, 1)

        // Step 3: go offline.
        disableNetwork()

        // Step 4: capture current events count.
        val eventsBeforeIdentify = getEventsCount()

        // Step 5: tap identify.
        TestHelpers.waitAndTap(device, By.res("identify-button"))

        // Step 6: wait until events-count has advanced by at least 1.
        TestHelpers.waitForElementText(device, "events-count") { text ->
            TestHelpers.parseEventsCount(text) >= eventsBeforeIdentify + 1
        }

        // Step 7: restore network so the Experience queue flushes.
        enableNetwork()

        // Step 8: wait for the queue flush round-trip to land.
        Thread.sleep(QUEUE_FLUSH_GRACE_MS)

        // Step 9: terminate and relaunch as a new instance.
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)

        // Step 10: wait until the identified nested variant entry exists.
        TestHelpers.waitForElement(device, By.res(NESTED_VARIANT_TEST_ID), POST_RELAUNCH_TIMEOUT)

        // Step 11: assert the anonymous baseline entry does not exist.
        Assert.assertNull(
            "Baseline nested entry $NESTED_BASELINE_TEST_ID should not exist after identified flush",
            device.findObject(By.res(NESTED_BASELINE_TEST_ID)),
        )
    }

    @Test
    fun testRecoverGracefullyWhenNetworkRestored() {
        // Step 1: wait until "Analytics Events" label is visible.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Step 2: go offline.
        disableNetwork()

        // Step 3: let the offline state stabilize.
        Thread.sleep(1_000L)

        // Step 4: restore network.
        enableNetwork()

        // Step 5: let the connectivity transition settle before identifying online.
        Thread.sleep(IDENTIFY_SETTLE_MS)

        // Step 6: tap identify.
        TestHelpers.waitAndTap(device, By.res("identify-button"))

        // Step 7: wait until reset-button is visible (SDK completed the identify pipeline).
        TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.ELEMENT_TIMEOUT)

        // Step 8: wait for the Experience upsert round-trip to land.
        Thread.sleep(IDENTIFY_SETTLE_MS)

        // Step 9: terminate and relaunch as a new instance.
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)

        // Step 10: wait until the identified nested variant entry exists.
        TestHelpers.waitForElement(device, By.res(NESTED_VARIANT_TEST_ID), POST_RELAUNCH_TIMEOUT)

        // Step 11: assert the anonymous baseline entry does not exist.
        Assert.assertNull(
            "Baseline nested entry $NESTED_BASELINE_TEST_ID should not exist after recovery identify",
            device.findObject(By.res(NESTED_BASELINE_TEST_ID)),
        )
    }

    @Test
    fun testHandleRapidNetworkStateChanges() {
        // Step 1: wait until "Analytics Events" label is visible.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)

        // Steps 2–8: rapid offline/online toggles ending online.
        disableNetwork()
        Thread.sleep(500L)
        enableNetwork()
        Thread.sleep(500L)
        disableNetwork()
        Thread.sleep(500L)
        enableNetwork()

        // Step 9: let the connectivity churn settle before identifying.
        Thread.sleep(IDENTIFY_SETTLE_MS)

        // Step 10: tap identify.
        TestHelpers.waitAndTap(device, By.res("identify-button"))

        // Step 11: wait until reset-button is visible (SDK completed the identify pipeline).
        TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.ELEMENT_TIMEOUT)

        // Step 12: wait for the Experience upsert round-trip to land.
        Thread.sleep(IDENTIFY_SETTLE_MS)

        // Step 13: terminate and relaunch as a new instance.
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)

        // Step 14: wait until the identified nested variant entry exists.
        TestHelpers.waitForElement(device, By.res(NESTED_VARIANT_TEST_ID), POST_RELAUNCH_TIMEOUT)

        // Step 15: assert the anonymous baseline entry does not exist.
        Assert.assertNull(
            "Baseline nested entry $NESTED_BASELINE_TEST_ID should not exist after rapid toggles",
            device.findObject(By.res(NESTED_BASELINE_TEST_ID)),
        )
    }

    @Test
    fun testQueueEventsOfflineAndFlushWhenOnline() {
        CiSkip.skipOnCi(
            "Asserts on `events-count` whose minimum threshold requires the same dwell-fired component events " +
                "covered by ViewTrackingControllerTest.",
        )
        // Step 1: wait until "Analytics Events" label is visible.
        TestHelpers.waitForElement(device, By.text("Analytics Events"), TestHelpers.ELEMENT_TIMEOUT)
        // Step 2: wait until at least 1 event has been tracked.
        TestHelpers.waitForEventsCountAtLeast(device, 1)

        // Step 3: go offline.
        disableNetwork()

        // Step 4: capture current events count.
        val eventsBeforeIdentify = getEventsCount()

        // Step 5: tap identify.
        TestHelpers.waitAndTap(device, By.res("identify-button"))

        // Step 6: wait until events-count has advanced by at least 1 (event tracked offline).
        TestHelpers.waitForElementText(device, "events-count") { text ->
            TestHelpers.parseEventsCount(text) >= eventsBeforeIdentify + 1
        }

        // Step 7: restore network so the offline Experience queue flushes.
        enableNetwork()

        // Step 8: wait for the flush round-trip to reach the server.
        Thread.sleep(QUEUE_FLUSH_GRACE_MS)

        // Step 9: terminate and relaunch as a new instance.
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)

        // Step 10: wait until the identified nested variant entry exists.
        TestHelpers.waitForElement(device, By.res(NESTED_VARIANT_TEST_ID), POST_RELAUNCH_TIMEOUT)

        // Step 11: assert the anonymous baseline entry does not exist.
        Assert.assertNull(
            "Baseline nested entry $NESTED_BASELINE_TEST_ID should not exist after queued flush",
            device.findObject(By.res(NESTED_BASELINE_TEST_ID)),
        )

        // Step 12: wait until reset-button is visible (identified profile preserved across cold start).
        TestHelpers.waitForElement(device, By.res("reset-button"), POST_RELAUNCH_TIMEOUT)
    }
}
