package com.contentful.optimization.uitests.support

import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until

fun UiDevice.swipeUpMultiple(times: Int, scrollViewId: String = "main-scroll-view") {
    repeat(times) {
        val bounds = findObject(By.res(scrollViewId))?.visibleBounds
        val centerX = bounds?.centerX() ?: (displayWidth / 2)
        val startY = bounds?.let { it.top + (it.height() * 3 / 4) } ?: (displayHeight * 3 / 4)
        val endY = bounds?.let { it.top + (it.height() / 4) } ?: (displayHeight / 4)
        swipe(centerX, startY, centerX, endY, 10)
        Thread.sleep(300)
    }
}

fun UiDevice.swipeDownMultiple(times: Int, scrollViewId: String = "main-scroll-view") {
    repeat(times) {
        val bounds = findObject(By.res(scrollViewId))?.visibleBounds
        val centerX = bounds?.centerX() ?: (displayWidth / 2)
        val startY = bounds?.let { it.top + (it.height() / 4) } ?: (displayHeight / 4)
        val endY = bounds?.let { it.top + (it.height() * 3 / 4) } ?: (displayHeight * 3 / 4)
        swipe(centerX, startY, centerX, endY, 10)
        Thread.sleep(300)
    }
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
