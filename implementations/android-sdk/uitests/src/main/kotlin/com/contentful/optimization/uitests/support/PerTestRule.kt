package com.contentful.optimization.uitests.support

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.rules.TestWatcher
import org.junit.rules.Timeout
import org.junit.runner.Description
import java.io.File
import java.util.concurrent.TimeUnit

object PerTestRule {
    private const val TAG = "PerTestRule"

    // 60s is generous: average test runs in ~7s; the slowest legitimate tests chain
    // two EXTENDED_TIMEOUT (30s) waits. Anything longer is a hang we want to abort.
    private const val PER_TEST_TIMEOUT_SECONDS = 60L

    // adb pull target. Cleared at suite start by the workflow.
    private val FAILURE_DIR = File("/sdcard/test-failures")

    fun create(): TestRule = RuleChain
        .outerRule(failureContextWatcher())
        .around(
            Timeout.builder()
                .withTimeout(PER_TEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                // If the test thread is stuck in native code and can't be interrupted,
                // dump its stack so we know where it wedged instead of just timing out.
                .withLookingForStuckThread(true)
                .build()
        )

    private fun failureContextWatcher(): TestWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val tag = "${description.className}#${description.methodName}"
            Log.e(TAG, "FAILED $tag: ${e.javaClass.simpleName}: ${e.message}")
            runCatching {
                FAILURE_DIR.mkdirs()
                val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                val hierarchy = File(FAILURE_DIR, "$tag.uix")
                val screenshot = File(FAILURE_DIR, "$tag.png")
                device.dumpWindowHierarchy(hierarchy)
                device.takeScreenshot(screenshot)
                Log.e(TAG, "Wrote failure context: ${hierarchy.absolutePath}, ${screenshot.absolutePath}")
            }.onFailure { Log.e(TAG, "Failed to capture failure context for $tag", it) }
        }
    }
}
