package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.AppLauncher
import com.contentful.optimization.uitests.support.PerTestRule
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Assert
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class UnidentifiedVariantsTests {
    @get:Rule
    val rule: TestRule = PerTestRule.create()

    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        clearProfileState(device, requireFreshAppInstance = true)
    }

    // Drives the unidentified -> identified round-trip the baseline tests rely on.
    // The home-screen optimized entries lock on their first resolved value, so a
    // mid-test identify does not re-resolve them; only a relaunch makes the SDK
    // re-run audience evaluation against the now-identified profile.
    private fun identifyAndRelaunch() {
        TestHelpers.waitForElement(device, By.res("identify-button"))
        TestHelpers.waitAndTap(device, By.res("identify-button"))
        TestHelpers.waitForElement(device, By.res("reset-button"))
        AppLauncher.forceStop(device)
        AppLauncher.launchApp(device)
        TestHelpers.waitForElement(device, By.res("main-scroll-view"), TestHelpers.EXTENDED_TIMEOUT)
    }

    // MARK: - common variants

    @Test
    fun testDisplaysMergeTagContentWithResolvedValue() {
        val expectedLabel = "This is a merge tag content entry that displays the visitor's continent \"EU\" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]"
        // The Android app resolves merge tags asynchronously, so wait for the
        // resolved description rather than asserting on it immediately.
        TestHelpers.waitForElement(device, By.desc(expectedLabel), TestHelpers.ELEMENT_TIMEOUT)
    }

    @Test
    fun testDisplaysVariantForVisitorsFromEurope() {
        TestHelpers.waitForElement(device, By.res("entry-text-4ib0hsHWoSOnCVdDkizE8d"))
        val expectedLabel = "This is a variant content entry for visitors from Europe. [Entry: 4ib0hsHWoSOnCVdDkizE8d]"
        Assert.assertNotNull(
            "Expected Europe variant content",
            device.findObject(By.desc(expectedLabel)),
        )
    }

    @Test
    fun testDisplaysVariantForDesktopBrowserVisitors() {
        TestHelpers.waitForElement(device, By.res("entry-text-xFwgG3oNaOcjzWiGe4vXo"))
        val expectedLabel = "This is a variant content entry for visitors using a desktop browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]"
        Assert.assertNotNull(
            "Expected desktop-browser variant content",
            device.findObject(By.desc(expectedLabel)),
        )
    }

    // MARK: - unidentified user variants

    @Test
    fun testDisplaysVariantForNewVisitors() {
        TestHelpers.waitForElement(device, By.res("entry-text-2Z2WLOx07InSewC3LUB3eX"))
        val expectedLabel = "This is a variant content entry for new visitors. [Entry: 2Z2WLOx07InSewC3LUB3eX]"
        Assert.assertNotNull(
            "Expected new-visitor variant content",
            device.findObject(By.desc(expectedLabel)),
        )
    }

    @Test
    fun testDisplaysVariantBForABCExperiment() {
        TestHelpers.waitForElement(device, By.res("entry-text-5XHssysWUDECHzKLzoIsg1"))
        val expectedLabel = "This is a variant content entry for an A/B/C experiment: B [Entry: 5XHssysWUDECHzKLzoIsg1]"
        Assert.assertNotNull(
            "Expected A/B/C experiment variant B",
            device.findObject(By.desc(expectedLabel)),
        )
    }

    @Test
    fun testDisplaysBaselineForVisitorsWithOrWithoutCustomEvent() {
        TestHelpers.waitForElement(device, By.res("entry-text-6zqoWXyiSrf0ja7I2WGtYj"))
        val baselineLabel = "This is a baseline content entry for all visitors with or without a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]"
        Assert.assertNotNull(
            "Expected baseline custom-event content",
            device.findObject(By.desc(baselineLabel)),
        )

        identifyAndRelaunch()

        val variantLabel = "This is a variant content entry for visitors with a custom event. [Entry: 6zqoWXyiSrf0ja7I2WGtYj]"
        TestHelpers.waitForElement(device, By.desc(variantLabel))
        Assert.assertNull(
            "Baseline custom-event content should be gone after identify",
            device.findObject(By.desc(baselineLabel)),
        )
    }

    @Test
    fun testDisplaysBaselineForAllIdentifiedOrUnidentifiedUsers() {
        TestHelpers.scrollToElement(device, "entry-text-7pa5bOx8Z9NmNcr7mISvD", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-7pa5bOx8Z9NmNcr7mISvD"))
        val baselineLabel = "This is a baseline content entry for all identified or unidentified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]"
        Assert.assertNotNull(
            "Expected baseline all-users content",
            device.findObject(By.desc(baselineLabel)),
        )

        identifyAndRelaunch()

        val variantLabel = "This is a variant content entry for identified users. [Entry: 7pa5bOx8Z9NmNcr7mISvD]"
        TestHelpers.waitForElement(device, By.desc(variantLabel))
        Assert.assertNull(
            "Baseline all-users content should be gone after identify",
            device.findObject(By.desc(baselineLabel)),
        )
    }

    // MARK: - nested optimization baselines

    @Test
    fun testDisplaysLevel0NestedBaselineForNewVisitors() {
        TestHelpers.scrollToElement(device, "entry-text-1JAU028vQ7v6nB2swl3NBo", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-1JAU028vQ7v6nB2swl3NBo"))
        val baselineLabel = "This is a level 0 nested baseline entry. [Entry: 1JAU028vQ7v6nB2swl3NBo]"
        Assert.assertNotNull(
            "Expected level 0 nested baseline content",
            device.findObject(By.desc(baselineLabel)),
        )

        identifyAndRelaunch()

        TestHelpers.scrollToElement(device, "entry-text-2KIWllNZJT205BwOSkMINg", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-2KIWllNZJT205BwOSkMINg"))
        Assert.assertNull(
            "Level 0 nested baseline content should be gone after identify",
            device.findObject(By.res("entry-text-1JAU028vQ7v6nB2swl3NBo")),
        )
    }

    @Test
    fun testDisplaysLevel1NestedBaselineForNewVisitors() {
        TestHelpers.scrollToElement(device, "entry-text-5i4SdJXw9oDEY0vgO7CwF4", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-5i4SdJXw9oDEY0vgO7CwF4"))
        val baselineLabel = "This is a level 1 nested baseline entry. [Entry: 5i4SdJXw9oDEY0vgO7CwF4]"
        Assert.assertNotNull(
            "Expected level 1 nested baseline content",
            device.findObject(By.desc(baselineLabel)),
        )

        identifyAndRelaunch()

        TestHelpers.scrollToElement(device, "entry-text-5a8ONfBdanJtlJ39WWnH1w", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-5a8ONfBdanJtlJ39WWnH1w"))
        Assert.assertNull(
            "Level 1 nested baseline content should be gone after identify",
            device.findObject(By.res("entry-text-5i4SdJXw9oDEY0vgO7CwF4")),
        )
    }

    @Test
    fun testDisplaysLevel2NestedBaselineForNewVisitors() {
        TestHelpers.scrollToElement(device, "entry-text-uaNY4YJ0HFPAX3gKXiRdX", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-uaNY4YJ0HFPAX3gKXiRdX"))
        val baselineLabel = "This is a level 2 nested baseline entry. [Entry: uaNY4YJ0HFPAX3gKXiRdX]"
        Assert.assertNotNull(
            "Expected level 2 nested baseline content",
            device.findObject(By.desc(baselineLabel)),
        )

        identifyAndRelaunch()

        TestHelpers.scrollToElement(device, "entry-text-4hDiXxYEFrXHXcQgmdL9Uv", "main-scroll-view")
        TestHelpers.waitForElement(device, By.res("entry-text-4hDiXxYEFrXHXcQgmdL9Uv"))
        Assert.assertNull(
            "Level 2 nested baseline content should be gone after identify",
            device.findObject(By.res("entry-text-uaNY4YJ0HFPAX3gKXiRdX")),
        )
    }
}
