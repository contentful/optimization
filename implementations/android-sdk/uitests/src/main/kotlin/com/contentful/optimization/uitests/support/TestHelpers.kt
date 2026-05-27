package com.contentful.optimization.uitests.support

import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.StaleObjectException
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import org.junit.Assert

object TestHelpers {
    const val ELEMENT_TIMEOUT = 20_000L
    const val EXTENDED_TIMEOUT = 30_000L
    private const val POLL_INTERVAL = 150L

    fun waitForElement(
        device: UiDevice,
        selector: BySelector,
        timeout: Long = ELEMENT_TIMEOUT,
    ): UiObject2 {
        val deadline = System.currentTimeMillis() + timeout
        while (System.currentTimeMillis() < deadline) {
            val element = device.findObject(selector)
            if (element != null) return element
            Thread.sleep(POLL_INTERVAL)
        }
        throw AssertionError("Element matching $selector did not appear within ${timeout}ms")
    }

    fun tapElement(device: UiDevice, element: UiObject2, singleClick: Boolean = false) {
        performAccessibilityClick(element)
        if (singleClick) return
        Thread.sleep(100)
        try {
            val bounds = element.visibleBounds
            device.click(bounds.centerX(), bounds.centerY())
        } catch (_: StaleObjectException) {
            // Element disappeared after accessibility click — click already worked
        }
    }

    private fun performAccessibilityClick(element: UiObject2): Boolean {
        try {
            val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
            val root = automation.rootInActiveWindow ?: return false
            val resourceId = element.resourceName
            val contentDesc = element.contentDescription
            val text = try { element.text } catch (_: Exception) { null }
            val node = findAccessibilityNode(root, resourceId, contentDesc, text)
            if (node != null) {
                return clickNodeOrClickableAncestor(node)
            }
            return false
        } catch (_: Exception) {
            return false
        }
    }

    private fun findAccessibilityNode(
        root: AccessibilityNodeInfo,
        resourceId: String?,
        contentDesc: String?,
        text: String? = null,
    ): AccessibilityNodeInfo? {
        if (resourceId != null) {
            val nodeRid = root.viewIdResourceName
            if (nodeRid != null && (nodeRid == resourceId || nodeRid.endsWith(":id/$resourceId"))) {
                return root
            }
        }
        if (contentDesc != null && root.contentDescription?.toString() == contentDesc) {
            return root
        }
        if (text != null && resourceId == null && contentDesc == null && root.text?.toString() == text) {
            return root
        }
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val result = findAccessibilityNode(child, resourceId, contentDesc, text)
            if (result != null) return result
        }
        return null
    }

    private fun clickNodeOrClickableAncestor(node: AccessibilityNodeInfo): Boolean {
        if (node.isClickable) {
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
        var current = node.parent
        while (current != null) {
            if (current.isClickable) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            current = current.parent
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
    }

    fun waitAndTap(
        device: UiDevice,
        selector: BySelector,
        timeout: Long = ELEMENT_TIMEOUT,
        singleClick: Boolean = false,
    ) {
        // Settle first, then resolve the element against the post-recomposition
        // accessibility tree. The previous order (resolve → idle → tap) handed
        // the captured UiObject2 across the idle wait — exactly the window in
        // which Compose recomposition invalidates the underlying node id,
        // causing the subsequent click to silently no-op on a stale handle.
        waitForElement(device, selector, timeout)
        device.waitForIdle(1500L)
        val element = waitForElement(device, selector, timeout)
        tapElement(device, element, singleClick = singleClick)
    }

    fun findElement(device: UiDevice, testId: String): UiObject2? {
        device.findObject(By.res(testId))?.let { return it }
        device.findObject(By.desc(testId))?.let { return it }
        device.findObject(By.text(testId))?.let { return it }
        return null
    }

    fun extractText(element: UiObject2): String {
        try {
            element.text?.takeIf { it.isNotEmpty() }?.let { return it }
            val parts = mutableListOf<String>()
            for (child in element.children) {
                child.contentDescription?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
                    ?: child.text?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
            }
            if (parts.isNotEmpty()) return parts.joinToString(" ")
            return element.contentDescription ?: ""
        } catch (_: StaleObjectException) {
            return ""
        }
    }

    fun getEntryContentText(device: UiDevice, entryId: String, timeout: Long = ELEMENT_TIMEOUT): String {
        val deadline = System.currentTimeMillis() + timeout
        while (System.currentTimeMillis() < deadline) {
            val element = device.findObject(By.descContains("[Entry: $entryId]"))
            if (element != null) return element.contentDescription ?: ""

            val wrapper = device.findObject(By.desc("content-entry-$entryId"))
            if (wrapper != null) {
                val bounds = wrapper.visibleBounds
                val candidates = device.findObjects(By.descContains("[Entry:"))
                for (candidate in candidates) {
                    val cb = candidate.visibleBounds
                    if (cb.top >= bounds.top && cb.bottom <= bounds.bottom) {
                        return candidate.contentDescription ?: ""
                    }
                }
            }

            Thread.sleep(POLL_INTERVAL)
        }
        return ""
    }

    fun getElementTextById(device: UiDevice, testId: String): String {
        val element = findElement(device, testId)
        Assert.assertNotNull("Element '$testId' not found", element)
        return extractText(element!!)
    }

    fun waitForElementText(
        device: UiDevice,
        testId: String,
        timeout: Long = ELEMENT_TIMEOUT,
        predicate: (String) -> Boolean,
    ): String {
        val deadline = System.currentTimeMillis() + timeout
        var lastText = ""

        while (System.currentTimeMillis() < deadline) {
            val el = findElement(device, testId)
            if (el != null) {
                lastText = extractText(el)
                if (predicate(lastText)) return lastText
            }
            Thread.sleep(POLL_INTERVAL)
        }

        Assert.fail("Timed out waiting for text condition on '$testId'. Last text: '$lastText'")
        return lastText
    }

    fun waitForTextEquals(
        device: UiDevice,
        testId: String,
        expected: String,
        timeout: Long = ELEMENT_TIMEOUT,
    ) {
        waitForElementText(device, testId, timeout) { it == expected }
    }

    fun waitForEventsCountAtLeast(
        device: UiDevice,
        minCount: Int,
        timeout: Long = ELEMENT_TIMEOUT,
    ) {
        scrollToElement(device, "events-count", "main-scroll-view")
        waitForElementText(device, "events-count", timeout) { text ->
            parseEventsCount(text) >= minCount
        }
    }

    fun parseEventsCount(text: String): Int {
        val match = Regex("""Events:\s*(\d+)""").find(text) ?: return 0
        return match.groupValues[1].toIntOrNull() ?: 0
    }

    fun waitForComponentEventCount(
        device: UiDevice,
        componentId: String,
        minCount: Int,
        scrollViewId: String = "main-scroll-view",
        timeout: Long = ELEMENT_TIMEOUT,
    ) {
        val testId = "event-count-$componentId"
        val deadline = System.currentTimeMillis() + timeout
        var lastText = ""
        var lastScrollTime = 0L

        while (System.currentTimeMillis() < deadline) {
            val now = System.currentTimeMillis()
            if (now - lastScrollTime > 2000) {
                scrollToElement(device, testId, scrollViewId)
                lastScrollTime = now
            }
            val el = findElement(device, testId)
            if (el != null) {
                lastText = extractText(el)
                if (parseComponentCount(lastText) >= minCount) return
            }
            Thread.sleep(POLL_INTERVAL)
        }

        Assert.fail("Timed out waiting for component event count >= $minCount on '$testId'. Last text: '$lastText'")
    }

    fun parseComponentCount(text: String): Int {
        val match = Regex("""Count:\s*(\d+)""").find(text) ?: return 0
        return match.groupValues[1].toIntOrNull() ?: 0
    }

    fun getViewDuration(device: UiDevice, componentId: String): Long? {
        val text = getElementTextById(device, "event-duration-$componentId")
        val match = Regex("""Duration:\s*(\d+)""").find(text) ?: return null
        return match.groupValues[1].toLongOrNull()
    }

    fun getViewId(device: UiDevice, componentId: String): String? {
        val text = getElementTextById(device, "event-view-id-$componentId")
        val match = Regex("""ViewId:\s*(.+)""").find(text) ?: return null
        val id = match.groupValues[1].trim()
        return if (id == "N/A") null else id
    }

    /**
     * Scrolls the scroll view until [testId] is found and on screen, using a
     * manual momentum-free swipe loop. Mirrors the iOS `scrollToElement`; the
     * `UiScrollable` search API is unreliable against a Compose `LazyColumn`.
     */
    fun scrollToElement(
        device: UiDevice,
        testId: String,
        scrollViewId: String,
        maxSwipes: Int = 12,
    ) {
        repeat(maxSwipes) {
            try {
                val el = findElement(device, testId)
                if (el != null && el.visibleBounds.height() > 0) return
            } catch (_: StaleObjectException) {
                // Handle went stale mid-recomposition; re-query next loop, don't scroll.
                return@repeat
            }
            device.scrollByOffset(dy = 700, scrollViewId = scrollViewId, fast = true)
        }
    }

    /**
     * Scrolls (momentum-free) until the entry [testId] is fully within the
     * scroll viewport — clipped at neither edge — so a fresh view-tracking cycle
     * starts at a known instant. Mirrors the iOS `scrollEntryIntoView`.
     */
    fun scrollEntryIntoView(
        device: UiDevice,
        testId: String,
        scrollViewId: String = "main-scroll-view",
        maxSteps: Int = 16,
    ) {
        repeat(maxSteps) {
            try {
                val el = findElement(device, testId)
                val scrollView = device.findObject(By.res(scrollViewId))?.visibleBounds
                if (el != null && scrollView != null) {
                    val b = el.visibleBounds
                    if (b.height() > 0 && b.top > scrollView.top + 8 && b.bottom < scrollView.bottom - 8) {
                        return
                    }
                }
            } catch (_: StaleObjectException) {
                // Handle went stale mid-recomposition; re-query next loop, don't scroll.
                return@repeat
            }
            device.scrollByOffset(dy = -260, scrollViewId = scrollViewId)
        }
    }

    fun scrollToElementByDescription(
        device: UiDevice,
        desc: String,
        scrollViewId: String,
        maxSwipes: Int = 10,
    ) {
        val scrollable = UiScrollable(UiSelector().resourceId(scrollViewId))
        scrollable.setMaxSearchSwipes(maxSwipes)
        try {
            scrollable.scrollIntoView(UiSelector().description(desc))
        } catch (_: Exception) {
            // Element may already be visible
        }
    }
}
