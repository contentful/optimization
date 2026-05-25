package com.contentful.optimization.uitests.support

import android.content.ComponentName
import android.content.Intent
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until

object AppLauncher {
    // Read the target app package from the instrumentation runner arguments so the same test APK
    // can drive both the Compose and the XML Views reference impls. Default is the Compose impl
    // so local IDE runs (`./gradlew :uitests:connectedAndroidTest`) keep working without extra
    // flags. The Android CI matrix and `scripts/run-e2e.sh` set `-e APP_PACKAGE <pkg>`.
    val APP_PACKAGE: String =
        InstrumentationRegistry.getArguments().getString("APP_PACKAGE")
            ?: "com.contentful.optimization.app"
    private val MAIN_ACTIVITY: String = "$APP_PACKAGE.MainActivity"

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
        device.executeShellCommand("am force-stop $APP_PACKAGE")
        Thread.sleep(500)
    }
}
