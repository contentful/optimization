package com.contentful.optimization.views

import com.contentful.optimization.core.OptimizationState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ScreenTrackerTest {

    @Test
    fun `operational failure is isolated and only consent changes retry`() = runTest {
        val state = MutableStateFlow(OptimizationState(consent = false))
        var attempts = 0
        val observer = launch {
            observeScreenTrackingConsent(state) {
                attempts += 1
                if (attempts == 1) throw IllegalStateException("joined request rejected")
            }
        }

        runCurrent()
        state.value = state.value.copy(experienceRequestState = mapOf("status" to "failed"))
        runCurrent()
        assertEquals(1, attempts)

        state.value = state.value.copy(consent = true)
        runCurrent()
        assertEquals(2, attempts)
        observer.cancelAndJoin()
    }

    @Test
    fun `pre-initialization call installs no deferred observer`() {
        var installed = false

        val observerInstalled = installScreenTrackingObserverIfReady(false) {
            installed = true
        }

        assertFalse(observerInstalled)
        assertFalse(installed)
    }

    @Test
    fun `cancellation from a tracking attempt is not swallowed`() = runTest {
        val expected = CancellationException("tracking cancelled")

        try {
            observeScreenTrackingConsent(flowOf(OptimizationState(consent = true))) {
                throw expected
            }
            fail("expected tracking cancellation to escape the observer")
        } catch (actual: CancellationException) {
            assertEquals(expected.message, actual.message)
        }
    }
}
