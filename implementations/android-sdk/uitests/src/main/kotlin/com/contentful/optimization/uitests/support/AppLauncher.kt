package com.contentful.optimization.uitests.support

import android.content.ComponentName
import android.content.Intent
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until

object AppLauncher {
    const val APP_PACKAGE = "com.contentful.optimization.app"
    private const val MAIN_ACTIVITY = "$APP_PACKAGE.MainActivity"

    fun launchApp(device: UiDevice, extras: Map<String, Boolean> = emptyMap()) {
        val context = InstrumentationRegistry.getInstrumentation().context
        val intent = Intent(Intent.ACTION_MAIN).apply {
            component = ComponentName(APP_PACKAGE, MAIN_ACTIVITY)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            for ((key, value) in extras) {
                putExtra(key, value)
            }
        }
        context.startActivity(intent)
        device.wait(Until.hasObject(By.pkg(APP_PACKAGE).depth(0)), TestHelpers.ELEMENT_TIMEOUT)
    }

    fun relaunchClean(device: UiDevice) {
        forceStop(device)
        launchApp(device, extras = mapOf("reset" to true))
        device.wait(
            Until.hasObject(By.res("identify-button")),
            TestHelpers.ELEMENT_TIMEOUT
        )
    }

    fun bringToForeground(device: UiDevice) {
        val context = InstrumentationRegistry.getInstrumentation().context
        val intent = Intent(Intent.ACTION_MAIN).apply {
            component = ComponentName(APP_PACKAGE, MAIN_ACTIVITY)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        device.wait(Until.hasObject(By.pkg(APP_PACKAGE).depth(0)), TestHelpers.ELEMENT_TIMEOUT)
    }

    fun forceStop(device: UiDevice) {
        device.executeShellCommand("am start -a android.intent.action.MAIN -c android.intent.category.HOME")
        Thread.sleep(500)
    }
}
