package com.contentful.optimization.uitests.support

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until

// A high step count slows the swipe so it ends at a low velocity with minimal
// fling momentum, leaving a scrolled entry at a predictable position for
// dwell-sensitive view-tracking assertions.
private const val MOMENTUM_FREE_STEPS = 160

fun UiDevice.swipeUpMultiple(times: Int, scrollViewId: String = "main-scroll-view") {
    repeat(times) {
        val bounds = findObject(By.res(scrollViewId))?.visibleBounds
        val centerX = bounds?.centerX() ?: (displayWidth / 2)
        val startY = bounds?.let { it.top + (it.height() * 3 / 4) } ?: (displayHeight * 3 / 4)
        val endY = bounds?.let { it.top + (it.height() / 4) } ?: (displayHeight / 4)
        swipe(centerX, startY, centerX, endY, MOMENTUM_FREE_STEPS)
        Thread.sleep(300)
    }
}

fun UiDevice.swipeDownMultiple(times: Int, scrollViewId: String = "main-scroll-view") {
    repeat(times) {
        val bounds = findObject(By.res(scrollViewId))?.visibleBounds
        val centerX = bounds?.centerX() ?: (displayWidth / 2)
        val startY = bounds?.let { it.top + (it.height() / 4) } ?: (displayHeight / 4)
        val endY = bounds?.let { it.top + (it.height() * 3 / 4) } ?: (displayHeight * 3 / 4)
        swipe(centerX, startY, centerX, endY, MOMENTUM_FREE_STEPS)
        Thread.sleep(300)
    }
}

/**
 * Scrolls the scroll view by a precise pixel offset. A positive [dy] reveals
 * lower content; a negative [dy] reveals upper content. The gesture is
 * momentum-free (slow, many small steps) by default so a tracked entry rests at
 * a predictable position; pass [fast] = true for a quick transit that an entry
 * should pass through without dwelling. Mirrors the iOS `scrollByOffset` helper.
 */
fun UiDevice.scrollByOffset(
    dy: Int,
    scrollViewId: String = "main-scroll-view",
    fast: Boolean = false,
) {
    val bounds = findObject(By.res(scrollViewId))?.visibleBounds ?: return
    val centerX = bounds.centerX()
    // Anchor near the bottom when revealing lower content, near the top when
    // revealing upper content, so the gesture endpoint stays on screen.
    val anchorY = if (dy > 0) {
        bounds.top + bounds.height() * 9 / 10
    } else {
        bounds.top + bounds.height() / 10
    }
    val endY = (anchorY - dy).coerceIn(bounds.top + 5, bounds.bottom - 5)
    if (endY == anchorY) return
    swipe(centerX, anchorY, centerX, endY, if (fast) 12 else MOMENTUM_FREE_STEPS)
}

fun clearProfileState(device: UiDevice, requireFreshAppInstance: Boolean = false) {
    if (requireFreshAppInstance) {
        AppLauncher.relaunchClean(device)
        device.wait(Until.hasObject(By.res("identify-button")), TestHelpers.ELEMENT_TIMEOUT)
        return
    }

    val closeLiveUpdates = device.findObject(By.res("close-live-updates-test-button"))
    if (closeLiveUpdates != null) {
        TestHelpers.tapElement(device, closeLiveUpdates)
        Thread.sleep(500)
    }

    val closeNavigation = device.findObject(By.res("close-navigation-test-button"))
    if (closeNavigation != null) {
        TestHelpers.tapElement(device, closeNavigation)
        Thread.sleep(500)
    }

    val resetButton = device.findObject(By.res("reset-button"))
    if (resetButton != null) {
        TestHelpers.tapElement(device, resetButton)
        device.wait(Until.hasObject(By.res("identify-button")), TestHelpers.ELEMENT_TIMEOUT)
        return
    }

    if (device.wait(Until.hasObject(By.res("identify-button")), 1_500L) == true) {
        return
    }

    AppLauncher.relaunchClean(device)
    device.wait(Until.hasObject(By.res("identify-button")), TestHelpers.ELEMENT_TIMEOUT)
}
