package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Assert
import org.junit.Before
import org.junit.BeforeClass
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class IdentifiedVariantsTests {
    private lateinit var device: UiDevice

    companion object {
        @JvmStatic
        @BeforeClass
        fun setUpClass() {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

            // Step 1: launch and clear any leftover profile state.
            AppLauncher.launchApp(device)
            clearProfileState(device)

            // Step 2: wait for identify-button, then tap it.
            TestHelpers.waitForElement(device, By.res("identify-button"), TestHelpers.ELEMENT_TIMEOUT)
            TestHelpers.waitAndTap(device, By.res("identify-button"))

            // Step 3: wait for reset-button, confirming identify succeeded.
            TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.EXTENDED_TIMEOUT)

            // Step 4: terminate the app.
            AppLauncher.forceStop(device)

            // Step 5: relaunch as a new instance so identified state is rehydrated
            // from persistent storage.
            AppLauncher.launchApp(device)

            // Step 6: wait for reset-button in the relaunched app. This proves
            // (a) the relaunch finished loading and (b) the identified profile
            // survived the cold start — the precondition every test in this suite
            // needs.
            TestHelpers.waitForElement(device, By.res("reset-button"), TestHelpers.EXTENDED_TIMEOUT)
        }
    }

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    }

    // MARK: - common variants

    @Test
    fun testShouldDisplayMergeTagContentWithResolvedValue() {
        val expected = "This is a merge tag content entry that displays the visitor's continent \"EU\" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]"
        // The Android app resolves merge tags asynchronously, so wait for the
        // resolved description rather than asserting on it immediately.
        TestHelpers.waitForElement(device, By.desc(expected), TestHelpers.ELEMENT_TIMEOUT)
    }

    @Test
    fun testShouldDisplayVariantForVisitorsFromEurope() {
        TestHelpers.waitForElement(device, By.res("entry-text-4ib0hsHWoSOnCVdDkizE8d"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]"
        Assert.assertNotNull(
            "Expected Europe continent variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    @Test
    fun testShouldDisplayVariantForDesktopBrowserVisitors() {
        TestHelpers.waitForElement(device, By.res("entry-text-xFwgG3oNaOcjzWiGe4vXo"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]"
        Assert.assertNotNull(
            "Expected desktop browser variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    // MARK: - identified user variants

    @Test
    fun testShouldDisplayVariantForReturnVisitors() {
        TestHelpers.waitForElement(device, By.res("entry-text-2Z2WLOx07InSewC3LUB3eX"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a variant content entry for return visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]"
        Assert.assertNotNull(
            "Expected return visitor variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    @Test
    fun testShouldDisplayVariantBForABCExperiment() {
        TestHelpers.waitForElement(device, By.res("entry-text-5XHssysWUDECHzKLzoIsg1"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]"
        Assert.assertNotNull(
            "Expected A/B/C experiment variant B label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    @Test
    fun testShouldDisplayVariantForVisitorsWithCustomEvent() {
        TestHelpers.waitForElement(device, By.res("entry-text-6zqoWXyiSrf0ja7I2WGtYj"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]"
        Assert.assertNotNull(
            "Expected custom event variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    @Test
    fun testShouldDisplayVariantForIdentifiedUsers() {
        scrollTo("entry-text-7pa5bOx8Z9NmNcr7mISvD")
        TestHelpers.waitForElement(device, By.res("entry-text-7pa5bOx8Z9NmNcr7mISvD"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]"
        Assert.assertNotNull(
            "Expected identified users variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    // MARK: - nested optimization variants

    @Test
    fun testShouldDisplayLevel0NestedVariantForReturnVisitors() {
        scrollTo("entry-text-2KIWllNZJT205BwOSkMINg")
        TestHelpers.waitForElement(device, By.res("entry-text-2KIWllNZJT205BwOSkMINg"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a level 0 nested variant entry. [Entry: 2KIWllNZJT205BwOSkMINg]"
        Assert.assertNotNull(
            "Expected level 0 nested variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    @Test
    fun testShouldDisplayLevel1NestedVariantForReturnVisitors() {
        scrollTo("entry-text-5a8ONfBdanJtlJ39WWnH1w")
        TestHelpers.waitForElement(device, By.res("entry-text-5a8ONfBdanJtlJ39WWnH1w"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a level 1 nested variant entry. [Entry: 5a8ONfBdanJtlJ39WWnH1w]"
        Assert.assertNotNull(
            "Expected level 1 nested variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    @Test
    fun testShouldDisplayLevel2NestedVariantForReturnVisitors() {
        scrollTo("entry-text-4hDiXxYEFrXHXcQgmdL9Uv")
        TestHelpers.waitForElement(device, By.res("entry-text-4hDiXxYEFrXHXcQgmdL9Uv"), TestHelpers.ELEMENT_TIMEOUT)
        val expected = "This is a level 2 nested variant entry. [Entry: 4hDiXxYEFrXHXcQgmdL9Uv]"
        Assert.assertNotNull(
            "Expected level 2 nested variant label to be visible",
            device.findObject(By.desc(expected)),
        )
    }

    private fun scrollTo(resourceId: String) {
        try {
            UiScrollable(UiSelector().resourceId("main-scroll-view"))
                .apply { setMaxSearchSwipes(10) }
                .scrollIntoView(UiSelector().resourceId(resourceId))
        } catch (_: Exception) {
            // Element may already be visible or scrolling not possible
        }
    }
}
