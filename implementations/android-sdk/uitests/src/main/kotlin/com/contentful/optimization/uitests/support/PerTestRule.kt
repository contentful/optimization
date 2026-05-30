package com.contentful.optimization.uitests.support

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.rules.TestWatcher
import org.junit.rules.Timeout
import org.junit.runner.Description
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.TimeUnit

object PerTestRule {
    private const val TAG = "PerTestRule"

    // 60s is generous: average test runs in ~7s; the slowest legitimate tests chain
    // two EXTENDED_TIMEOUT (30s) waits. Anything longer is a hang we want to abort.
    private const val PER_TEST_TIMEOUT_SECONDS = 60L

    // Per-test failure dumps are written here. We use the *test app's* external files dir
    // (e.g. /sdcard/Android/data/com.contentful.optimization.uitests/files/test-failures/)
    // because Android scoped storage on API 30+ denies app processes write access to the
    // root `/sdcard/` even when adb pre-created the directory — observed as
    // `EPERM (Operation not permitted)` from FileOutputStream in CI logcat.
    private val FAILURE_DIR: File by lazy {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        File(context.getExternalFilesDir(null), "test-failures").apply { mkdirs() }
    }

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
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            dumpHierarchyToLogcat(device, tag)
            runCatching {
                val hierarchy = File(FAILURE_DIR, "$tag.uix")
                val screenshot = File(FAILURE_DIR, "$tag.png")
                device.dumpWindowHierarchy(hierarchy)
                device.takeScreenshot(screenshot)
                Log.e(TAG, "Wrote failure context: ${hierarchy.absolutePath}, ${screenshot.absolutePath}")
            }.onFailure { Log.e(TAG, "Failed to write failure context file for $tag", it) }
        }
    }

    // Dump the window hierarchy to logcat so it survives even when the device-side file
    // capture fails (e.g. /sdcard EPERM). The CI workflow's `adb logcat -d` will pull
    // these lines into the run artifact, giving us the same forensic data without
    // depending on writable shared storage.
    private fun dumpHierarchyToLogcat(device: UiDevice, tag: String) {
        runCatching {
            val buffer = ByteArrayOutputStream()
            device.dumpWindowHierarchy(buffer)
            val xml = buffer.toString(Charsets.UTF_8.name())
            Log.e(TAG, "BEGIN HIERARCHY DUMP $tag (${xml.length} bytes)")
            // logcat truncates lines past ~4000 chars; chunk the XML into safe slices.
            xml.chunked(LOGCAT_LINE_LIMIT).forEachIndexed { i, slice ->
                Log.e(TAG, "HIER[$tag] $i: $slice")
            }
            Log.e(TAG, "END HIERARCHY DUMP $tag")
        }.onFailure { Log.e(TAG, "dumpHierarchyToLogcat failed for $tag", it) }
    }

    private const val LOGCAT_LINE_LIMIT = 3500
}
