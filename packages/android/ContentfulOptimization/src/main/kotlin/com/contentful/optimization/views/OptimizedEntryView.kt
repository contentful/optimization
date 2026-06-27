package com.contentful.optimization.views

import android.content.Context
import android.graphics.Rect
import android.util.AttributeSet
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import com.contentful.optimization.core.ResolvedOptimizedEntry
import com.contentful.optimization.core.TrackClickPayload
import com.contentful.optimization.core.resolvePreviewCloseLockState
import com.contentful.optimization.tracking.TrackingMetadata
import com.contentful.optimization.tracking.VIEW_TRACKING_LOG_TAG
import com.contentful.optimization.tracking.ViewTrackingController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * View-based counterpart of [com.contentful.optimization.compose.OptimizedEntry].
 *
 * Wraps a single Contentful entry and renders the resolved optimized entry through a
 * caller-supplied [contentRenderer]. Owns a [ViewTrackingController] for visibility-based view
 * tracking and forwards click events to [com.contentful.optimization.core.OptimizationClient.trackClick].
 *
 * Live-updates and locking semantics mirror `OptimizedEntry` so the same Contentful entry
 * behaves identically whether rendered through Compose or XML Views.
 *
 * Typical use:
 * ```kotlin
 * val view = OptimizedEntryView(context)
 * view.setContentRenderer { resolvedEntry ->
 *     TextView(context).apply {
 *         text = (resolvedEntry["fields"] as? Map<*, *>)?.get("text") as? String
 *     }
 * }
 * view.accessibilityIdentifier = "content-entry-$id"
 * view.setEntry(rawEntry)
 * ```
 */
public class OptimizedEntryView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    // Configuration — public so consumers can tune per-instance without subclassing.
    var dwellTimeMs: Int = 2000
    var minVisibleRatio: Double = 0.8
    var viewDurationUpdateIntervalMs: Int = 5000
    var liveUpdates: Boolean? = null
    var trackViews: Boolean? = null
    var trackTaps: Boolean? = null
    var onTap: ((Map<String, Any>) -> Unit)? = null

    /**
     * Scopes the entry's accessibility identifier. Mirrors `OptimizedEntry`'s
     * `accessibilityIdentifier` parameter, which is the SDK's `contentDescription` contract.
     */
    var accessibilityIdentifier: String? = null
        set(value) {
            field = value
            contentDescription = value
        }

    private var entry: Map<String, Any>? = null
    private var selectedOptimizationsOverride: List<Map<String, Any>>? = null
    private var contentRenderer: ((Map<String, Any>) -> View)? = null

    private var trackingScope: CoroutineScope? = null
    private var optimizationJob: Job? = null
    private var previewJob: Job? = null
    private var consentJob: Job? = null

    private var controller: ViewTrackingController? = null
    private var lockedOptimizations: List<Map<String, Any>>? = null
    private var isLocked: Boolean = false
    private var lastResult: ResolvedOptimizedEntry? = null
    // Track the (entry, selectedOptimization) tuple the current controller was built for so we
    // don't tear it down on every optimization re-emission — that would reset the dwell
    // timer and prevent component events from ever firing. Mirrors Compose's
    // `remember(entry, selectedOptimization, optimizationContextId)` semantics.
    private var controllerEntry: Map<String, Any>? = null
    private var controllerSelectedOptimization: Map<String, Any>? = null
    private var controllerOptimizationContextId: String? = null

    private val preDrawListener = ViewTreeObserver.OnPreDrawListener {
        updateVisibility()
        true
    }

    /**
     * Set the renderer that turns a resolved entry map into a child View. Called on every
     * optimization update; the returned View replaces the previous content.
     */
    fun setContentRenderer(renderer: (Map<String, Any>) -> View) {
        this.contentRenderer = renderer
        lastResult?.let { renderContent(it.entry) }
    }

    /**
     * Set the entry to optimize. Optional [selectedOptimizations] forces a specific set instead
     * of observing the live selectedOptimizations stream (used by tests or callers driving their own
     * optimization state).
     */
    fun setEntry(
        entry: Map<String, Any>,
        selectedOptimizations: List<Map<String, Any>>? = null,
    ) {
        this.entry = entry
        this.selectedOptimizationsOverride = selectedOptimizations
        this.lockedOptimizations = null
        this.isLocked = false
        restartObservation()
    }

    /** Force a visibility re-check from outside (e.g., from [TrackingRecyclerView] on scroll). */
    fun requestVisibilityCheck() {
        updateVisibility()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        trackingScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        viewTreeObserver.addOnPreDrawListener(preDrawListener)
        setOnClickListener { fireTrackClick() }
        restartObservation()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        viewTreeObserver.removeOnPreDrawListener(preDrawListener)
        controller?.let {
            it.onDisappear()
            it.destroy()
        }
        controller = null
        controllerEntry = null
        controllerSelectedOptimization = null
        controllerOptimizationContextId = null
        trackingScope?.cancel()
        trackingScope = null
        optimizationJob = null
        previewJob = null
        consentJob = null
    }

    private fun restartObservation() {
        val scope = trackingScope ?: return
        val entry = entry ?: return
        val client = OptimizationManager.client

        controller?.let {
            it.onDisappear()
            it.destroy()
        }
        controller = null
        controllerEntry = null
        controllerSelectedOptimization = null
        controllerOptimizationContextId = null
        optimizationJob?.cancel()
        previewJob?.cancel()
        consentJob?.cancel()

        @Suppress("UNCHECKED_CAST")
        val fields = entry["fields"] as? Map<String, Any>
        val isOptimized = fields?.containsKey("nt_experiences") == true
        val explicitOverride = selectedOptimizationsOverride

        optimizationJob = scope.launch {
            if (!isOptimized || explicitOverride != null) {
                // Plain entry — or caller-supplied selectedOptimizations. No live observation.
                publishResult(
                    client.resolveOptimizedEntry(baseline = entry, selectedOptimizations = explicitOverride),
                )
                return@launch
            }
            // Mirrors the OptimizedEntry composable: collect each optimization emission
            // rather than snapshotting, so the rapid sequence triggered by identify() is not
            // coalesced.
            client.selectedOptimizations.collect { newValue ->
                val previewOpen = client.isPreviewPanelOpen.value
                val shouldLive =
                    if (previewOpen) true else liveUpdates ?: OptimizationManager.liveUpdates
                if (!shouldLive && !isLocked && newValue != null) {
                    lockedOptimizations = newValue
                    isLocked = true
                }
                val effective = if (shouldLive) newValue else lockedOptimizations
                publishResult(
                    client.resolveOptimizedEntry(baseline = entry, selectedOptimizations = effective),
                )
            }
        }

        previewJob = scope.launch {
            client.isPreviewPanelOpen.collect { open ->
                val lockState = resolvePreviewCloseLockState(
                    isOptimized = isOptimized,
                    isPreviewPanelOpen = open,
                    nonPreviewLiveUpdates = liveUpdates ?: OptimizationManager.liveUpdates,
                    hasSelectedOptimizationsOverride = explicitOverride != null,
                    selectedOptimizations = client.selectedOptimizations.value,
                ) ?: return@collect

                lockedOptimizations = lockState.lockedOptimizations
                if (lockState.shouldLock) {
                    isLocked = true
                }
                publishResult(
                    client.resolveOptimizedEntry(
                        baseline = entry,
                        selectedOptimizations = lockedOptimizations,
                    ),
                )
            }
        }

        consentJob = scope.launch {
            client.state.collect {
                lastResult?.let { result -> attachController(result) }
                updateVisibility()
            }
        }
    }

    private fun publishResult(result: ResolvedOptimizedEntry) {
        lastResult = result
        renderContent(result.entry)
        attachController(result)
    }

    private fun renderContent(entry: Map<String, Any>) {
        val renderer = contentRenderer ?: return
        removeAllViews()
        addView(renderer(entry))
    }

    private fun attachController(result: ResolvedOptimizedEntry) {
        if (!resolveTrackViews()) return
        val client = OptimizationManager.client
        if (!client.hasConsent("trackView")) {
            controller?.let {
                it.onDisappear()
                it.destroy()
            }
            controller = null
            controllerEntry = null
            controllerSelectedOptimization = null
            controllerOptimizationContextId = null
            return
        }
        val entry = entry ?: return
        val newSelectedOptimization = result.selectedOptimization
        val newOptimizationContextId = result.optimizationContextId
        @Suppress("UNCHECKED_CAST")
        val entryId = (entry["sys"] as? Map<String, Any>)?.get("id") as? String ?: ""

        // If the controller is already wired up for the same (entry, selectedOptimization) tuple,
        // keep it — rebuilding would reset the dwell timer mid-cycle.
        if (controller != null &&
            controllerEntry === entry &&
            controllerSelectedOptimization == newSelectedOptimization &&
            controllerOptimizationContextId == newOptimizationContextId
        ) {
            trackingLog { "attachController KEEP componentId=$entryId" }
            updateVisibility()
            return
        }

        if (controller != null) {
            trackingLog { "attachController REBUILD componentId=$entryId (was different tuple)" }
        } else {
            trackingLog { "attachController CREATE componentId=$entryId" }
        }

        controller?.let {
            it.onDisappear()
            it.destroy()
        }
        controller = ViewTrackingController(
            client = client,
            entry = entry,
            optimizationContextId = newOptimizationContextId,
            selectedOptimization = newSelectedOptimization,
            minVisibleRatio = minVisibleRatio,
            dwellTimeMs = dwellTimeMs,
            viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
        )
        controllerEntry = entry
        controllerSelectedOptimization = newSelectedOptimization
        controllerOptimizationContextId = newOptimizationContextId
        updateVisibility()
    }

    private fun updateVisibility() {
        val controller = controller ?: return
        if (!isAttachedToWindow || height == 0) return

        // getGlobalVisibleRect intersects with every ancestor's clip rect plus the window's
        // visible area, so rect.height() is the truly-visible portion of this view.
        val rect = Rect()
        val visible = getGlobalVisibleRect(rect)
        val elementHeight = height.toFloat()
        val visibleHeight = if (visible) rect.height().toFloat() else 0f

        // Encode the visibility geometry as (elementY=0, scrollY=0, viewportHeight=visibleHeight)
        // so ViewTrackingController computes ratio = visibleHeight / elementHeight, matching the
        // ratio the Compose `Modifier.trackViews` derives from its scroll-aware geometry.
        controller.updateVisibility(
            elementY = 0f,
            elementHeight = elementHeight,
            scrollY = 0f,
            viewportHeight = visibleHeight,
        )
    }

    private fun fireTrackClick() {
        if (!resolveTrackTaps()) return
        val entry = entry ?: return
        if (OptimizationManager.client.hasConsent("trackClick")) {
            val scope = trackingScope
            if (scope != null) {
                val metadata = TrackingMetadata(
                    entry,
                    lastResult?.selectedOptimization,
                    lastResult?.optimizationContextId,
                )
                scope.launch {
                    try {
                        OptimizationManager.client.trackClick(
                            TrackClickPayload(
                                componentId = metadata.componentId,
                                experienceId = metadata.experienceId,
                                optimizationContextId = metadata.optimizationContextId,
                                variantIndex = metadata.variantIndex,
                            ),
                        )
                    } catch (_: Exception) {
                    }
                }
            }
        }
        onTap?.invoke(entry)
    }

    private fun resolveTrackViews(): Boolean = trackViews ?: OptimizationManager.trackViews

    private fun resolveTrackTaps(): Boolean {
        val explicit = trackTaps
        return when {
            explicit == false -> false
            explicit != null || onTap != null -> true
            else -> OptimizationManager.trackTaps
        }
    }
}

private inline fun trackingLog(message: () -> String) {
    if (android.util.Log.isLoggable(VIEW_TRACKING_LOG_TAG, android.util.Log.DEBUG)) {
        android.util.Log.d(VIEW_TRACKING_LOG_TAG, message())
    }
}
