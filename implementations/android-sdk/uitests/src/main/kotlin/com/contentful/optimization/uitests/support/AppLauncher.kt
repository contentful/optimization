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
        // Let UiAutomator's accessibility cache drain old-window nodes before
        // the new activity registers — `am force-stop` kills the app process
        // but the instrumentation process keeps holding `AccessibilityNodeInfo`
        // references from the previous window, and a too-fast relaunch leaves
        // the next `findObject` resolving against a stale snapshot.
        device.waitForIdle(1_000L)
        launchApp(device, extras = mapOf("reset" to true))
        device.wait(
            Until.hasObject(By.res("identify-button")),
            TestHelpers.ELEMENT_TIMEOUT
        )
        // After identify-button is present, give Compose's initial accessibility
        // tree one more idle round so the next findObject sees the settled tree.
        device.waitForIdle(1_000L)
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
        // Poll until the app process is actually gone — `am force-stop` returns
        // immediately but the kernel-side teardown lags. Without this gate, the
        // subsequent `am start` can race against the dying process and the new
        // activity's accessibility tree gets attached before the old one is
        // fully torn down.
        val deadline = System.currentTimeMillis() + 5_000L
        while (System.currentTimeMillis() < deadline) {
            val pid = device.executeShellCommand("pidof $APP_PACKAGE").trim()
            if (pid.isEmpty()) return
            Thread.sleep(100)
        }
        // Don't fail the test if we can't confirm death — the process may have
        // already exited and the next `am start` will work; just fall through.
    }
}
