package com.contentful.optimization.views

import android.content.Context
import android.graphics.Rect
import android.util.AttributeSet
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import com.contentful.optimization.core.PersonalizedResult
import com.contentful.optimization.core.TrackClickPayload
import com.contentful.optimization.tracking.TrackingMetadata
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
 * Wraps a single Contentful entry and renders the resolved (personalized) entry through a
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
class OptimizedEntryView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    // Configuration — public so consumers can tune per-instance without subclassing.
    var viewTimeMs: Int = 2000
    var threshold: Double = 0.8
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
    private var personalizationsOverride: List<Map<String, Any>>? = null
    private var contentRenderer: ((Map<String, Any>) -> View)? = null

    private var trackingScope: CoroutineScope? = null
    private var personalizationJob: Job? = null
    private var previewJob: Job? = null

    private var controller: ViewTrackingController? = null
    private var lockedPersonalizations: List<Map<String, Any>>? = null
    private var isLocked: Boolean = false
    private var lastResult: PersonalizedResult? = null
    // Track the (entry, personalization) tuple the current controller was built for so we
    // don't tear it down on every personalization re-emission — that would reset the dwell
    // timer and prevent component events from ever firing. Mirrors Compose's
    // `remember(entry, personalization)` semantics.
    private var controllerEntry: Map<String, Any>? = null
    private var controllerPersonalization: Map<String, Any>? = null

    private val preDrawListener = ViewTreeObserver.OnPreDrawListener {
        updateVisibility()
        true
    }

    /**
     * Set the renderer that turns a resolved entry map into a child View. Called on every
     * personalization update; the returned View replaces the previous content.
     */
    fun setContentRenderer(renderer: (Map<String, Any>) -> View) {
        this.contentRenderer = renderer
        lastResult?.let { renderContent(it.entry) }
    }

    /**
     * Set the entry to personalize. Optional [personalizations] forces a specific set instead
     * of observing the live personalizations stream (used by tests or callers driving their own
     * personalization state).
     */
    fun setEntry(
        entry: Map<String, Any>,
        personalizations: List<Map<String, Any>>? = null,
    ) {
        this.entry = entry
        this.personalizationsOverride = personalizations
        this.lockedPersonalizations = null
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
        if (resolveTrackTaps()) {
            setOnClickListener { fireTrackClick() }
        }
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
        trackingScope?.cancel()
        trackingScope = null
        personalizationJob = null
        previewJob = null
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
        controllerPersonalization = null
        personalizationJob?.cancel()
        previewJob?.cancel()

        @Suppress("UNCHECKED_CAST")
        val fields = entry["fields"] as? Map<String, Any>
        val isPersonalized = fields?.containsKey("nt_experiences") == true
        val explicitOverride = personalizationsOverride

        personalizationJob = scope.launch {
            if (!isPersonalized || explicitOverride != null) {
                // Plain entry — or caller-supplied personalizations. No live observation.
                publishResult(
                    client.personalizeEntry(baseline = entry, personalizations = explicitOverride),
                )
                return@launch
            }
            // Mirrors the OptimizedEntry composable: collect each personalization emission
            // rather than snapshotting, so the rapid sequence triggered by identify() is not
            // coalesced.
            client.selectedPersonalizations.collect { newValue ->
                val previewOpen = client.isPreviewPanelOpen.value
                val shouldLive =
                    if (previewOpen) true else liveUpdates ?: OptimizationManager.liveUpdates
                if (!shouldLive && !isLocked && newValue != null) {
                    lockedPersonalizations = newValue
                    isLocked = true
                }
                val effective = if (shouldLive) newValue else lockedPersonalizations
                publishResult(
                    client.personalizeEntry(baseline = entry, personalizations = effective),
                )
            }
        }

        previewJob = scope.launch {
            client.isPreviewPanelOpen.collect { open ->
                if (!open && isPersonalized && isLocked) {
                    lockedPersonalizations = client.selectedPersonalizations.value
                    publishResult(
                        client.personalizeEntry(
                            baseline = entry,
                            personalizations = lockedPersonalizations,
                        ),
                    )
                }
            }
        }
    }

    private fun publishResult(result: PersonalizedResult) {
        lastResult = result
        renderContent(result.entry)
        attachController(result)
    }

    private fun renderContent(entry: Map<String, Any>) {
        val renderer = contentRenderer ?: return
        removeAllViews()
        addView(renderer(entry))
    }

    private fun attachController(result: PersonalizedResult) {
        if (!resolveTrackViews()) return
        val entry = entry ?: return
        val newPersonalization = result.personalization
        @Suppress("UNCHECKED_CAST")
        val entryId = (entry["sys"] as? Map<String, Any>)?.get("id") as? String ?: ""

        // If the controller is already wired up for the same (entry, personalization) tuple,
        // keep it — rebuilding would reset the dwell timer mid-cycle.
        if (controller != null &&
            controllerEntry === entry &&
            controllerPersonalization == newPersonalization
        ) {
            android.util.Log.d("ViewTracking", "attachController KEEP componentId=$entryId")
            updateVisibility()
            return
        }

        if (controller != null) {
            android.util.Log.d("ViewTracking", "attachController REBUILD componentId=$entryId (was different tuple)")
        } else {
            android.util.Log.d("ViewTracking", "attachController CREATE componentId=$entryId")
        }

        controller?.let {
            it.onDisappear()
            it.destroy()
        }
        controller = ViewTrackingController(
            client = OptimizationManager.client,
            entry = entry,
            personalization = newPersonalization,
            threshold = threshold,
            viewTimeMs = viewTimeMs,
            viewDurationUpdateIntervalMs = viewDurationUpdateIntervalMs,
        )
        controllerEntry = entry
        controllerPersonalization = newPersonalization
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
        val entry = entry ?: return
        val scope = trackingScope ?: return
        val metadata = TrackingMetadata(entry, lastResult?.personalization)
        scope.launch {
            try {
                OptimizationManager.client.trackClick(
                    TrackClickPayload(
                        componentId = metadata.componentId,
                        experienceId = metadata.experienceId,
                        variantIndex = metadata.variantIndex,
                    ),
                )
            } catch (_: Exception) {
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
