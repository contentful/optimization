package com.contentful.optimization.uitests.support

import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assume

/**
 * Runtime-conditional skip for dwell-sensitive E2E tests on CI.
 *
 * A handful of tests in this suite assert that the SDK's `ViewTrackingController` fires its
 * `trackView` callback after the 2-second dwell timer elapses. That contract is correct, but
 * verifying it through a real x86_64 emulator means the assertion is racing the test framework's
 * own `scrollToElement` swipe — when the swipe begins before dwell completes, the entry's
 * visibility ratio drops below the 0.8 threshold and `resetCycle()` wipes the in-progress dwell,
 * so no event ever fires. The contract itself is now covered deterministically in JVM unit tests
 * (`packages/android/.../tracking/ViewTrackingControllerTest`), and the E2E variants survive
 * here only for local exploratory runs where the full bridge → mock Insights round-trip is
 * useful to eyeball.
 *
 * Skip mechanism: read the `CI` instrumentation argument passed by `am instrument -e CI true`
 * in `.github/workflows/main-pipeline.yaml`, and `Assume.assumeFalse(...)` to mark the test as
 * skipped (not failed). `scripts/run-e2e.sh` does NOT pass that argument, so local invocations
 * still exercise these tests normally. The skip surfaces as `INSTRUMENTATION_STATUS_CODE: -3`
 * (assumption-failed) in the instrumentation output stream — distinct from the test-failure
 * code (-2) and the assumption-passed code (0), so the existing workflow grep checks treat it
 * as a non-failure outcome.
 */
object CiSkip {
    private const val CI_ARG = "CI"

    /**
     * @param reason short explanation surfaced in the JUnit stack=... block alongside the
     * `AssumptionViolatedException`. Should describe why this test is unreliable on CI —
     * typically a pointer to the unit test that covers the same contract.
     */
    fun skipOnCi(reason: String) {
        val ci = InstrumentationRegistry.getArguments().getString(CI_ARG) == "true"
        Assume.assumeFalse(
            "Skipped on CI ($reason). Run locally via scripts/run-e2e.sh to exercise this path.",
            ci,
        )
    }
}
