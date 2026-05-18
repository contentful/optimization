package com.contentful.optimization.uitests.tests

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.contentful.optimization.uitests.support.TestHelpers
import com.contentful.optimization.uitests.support.clearProfileState
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class UnidentifiedVariantsTests {
    private lateinit var device: UiDevice

    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        clearProfileState(device, requireFreshAppInstance = true)
    }

    @Test
    fun testDisplaysMergeTagEntry() {
        TestHelpers.waitForElement(device, By.desc("content-entry-1MwiFl4z7gkwqGYdvCmr8c"))
        val text = TestHelpers.getEntryContentText(device, "1MwiFl4z7gkwqGYdvCmr8c")
        Assert.assertTrue("Entry should have content", text.isNotEmpty())
    }

    @Test
    fun testDisplaysContinentBasedEntry() {
        TestHelpers.waitForElement(device, By.desc("content-entry-4ib0hsHWoSOnCVdDkizE8d"))
        val text = TestHelpers.getEntryContentText(device, "4ib0hsHWoSOnCVdDkizE8d")
        Assert.assertTrue(
            "Expected continent-based content, got: $text",
            text.contains("continent", ignoreCase = true) || text.contains("Europe", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysDeviceBasedEntry() {
        TestHelpers.waitForElement(device, By.desc("content-entry-xFwgG3oNaOcjzWiGe4vXo"))
        val text = TestHelpers.getEntryContentText(device, "xFwgG3oNaOcjzWiGe4vXo")
        Assert.assertTrue(
            "Expected device-based content, got: $text",
            text.contains("device", ignoreCase = true) || text.contains("desktop", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysBaselineForNewVisitors() {
        TestHelpers.waitForElement(device, By.desc("content-entry-2Z2WLOx07InSewC3LUB3eX"))
        val text = TestHelpers.getEntryContentText(device, "2Z2WLOx07InSewC3LUB3eX")
        Assert.assertTrue(
            "Expected baseline content, got: $text",
            text.contains("baseline", ignoreCase = true) ||
                text.contains("new", ignoreCase = true) ||
                text.contains("all", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysABCExperimentEntry() {
        TestHelpers.waitForElement(device, By.desc("content-entry-5XHssysWUDECHzKLzoIsg1"))
        val text = TestHelpers.getEntryContentText(device, "5XHssysWUDECHzKLzoIsg1")
        Assert.assertTrue(
            "Expected A/B/C experiment content, got: $text",
            text.contains("A/B/C", ignoreCase = true) || text.contains("experiment", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysCustomEventEntry() {
        TestHelpers.waitForElement(device, By.desc("content-entry-6zqoWXyiSrf0ja7I2WGtYj"))
        val text = TestHelpers.getEntryContentText(device, "6zqoWXyiSrf0ja7I2WGtYj")
        Assert.assertTrue(
            "Expected custom event entry content, got: $text",
            text.contains("custom event", ignoreCase = true) || text.contains("baseline", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysIdentificationEntry() {
        TestHelpers.scrollToElementByDescription(device, "content-entry-7pa5bOx8Z9NmNcr7mISvD", "main-scroll-view")
        TestHelpers.waitForElement(device, By.desc("content-entry-7pa5bOx8Z9NmNcr7mISvD"))
        val text = TestHelpers.getEntryContentText(device, "7pa5bOx8Z9NmNcr7mISvD")
        Assert.assertTrue(
            "Expected identification entry content, got: $text",
            text.contains("identified", ignoreCase = true) || text.contains("baseline", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysLevel0NestedBaseline() {
        TestHelpers.scrollToElementByDescription(device, "content-entry-1JAU028vQ7v6nB2swl3NBo", "main-scroll-view")
        TestHelpers.waitForElement(device, By.desc("content-entry-1JAU028vQ7v6nB2swl3NBo"))
        val text = TestHelpers.getEntryContentText(device, "1JAU028vQ7v6nB2swl3NBo", TestHelpers.EXTENDED_TIMEOUT)
        Assert.assertTrue(
            "Expected level 0 nested baseline content, got: $text",
            text.contains("level 0", ignoreCase = true) ||
                text.contains("nested", ignoreCase = true) ||
                text.contains("baseline", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysLevel1NestedBaseline() {
        TestHelpers.scrollToElementByDescription(device, "content-entry-5i4SdJXw9oDEY0vgO7CwF4", "main-scroll-view")
        TestHelpers.waitForElement(device, By.desc("content-entry-5i4SdJXw9oDEY0vgO7CwF4"))
        val text = TestHelpers.getEntryContentText(device, "5i4SdJXw9oDEY0vgO7CwF4")
        Assert.assertTrue(
            "Expected level 1 nested baseline content, got: $text",
            text.contains("level 1", ignoreCase = true) ||
                text.contains("nested", ignoreCase = true) ||
                text.contains("baseline", ignoreCase = true),
        )
    }

    @Test
    fun testDisplaysLevel2NestedBaseline() {
        TestHelpers.scrollToElementByDescription(device, "content-entry-uaNY4YJ0HFPAX3gKXiRdX", "main-scroll-view")
        TestHelpers.waitForElement(device, By.desc("content-entry-uaNY4YJ0HFPAX3gKXiRdX"))
        val text = TestHelpers.getEntryContentText(device, "uaNY4YJ0HFPAX3gKXiRdX")
        Assert.assertTrue(
            "Expected level 2 nested baseline content, got: $text",
            text.contains("level 2", ignoreCase = true) ||
                text.contains("nested", ignoreCase = true) ||
                text.contains("baseline", ignoreCase = true),
        )
    }
}
