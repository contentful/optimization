package com.contentful.optimization.views

import android.app.Activity
import android.content.Context
import android.view.View
import com.contentful.optimization.core.OptimizationClient
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.preview.PreviewContentfulClient
import com.contentful.optimization.preview.PreviewPanelActivity
import com.contentful.optimization.preview.PreviewPanelConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.concurrent.atomic.AtomicReference

/**
 * View-based counterpart of [com.contentful.optimization.compose.OptimizationRoot].
 *
 * Initializes a process-wide [OptimizationClient] for XML/Views-based apps and exposes it via
 * [client]. Reference implementations and consumer apps should call [initialize] from
 * `Application.onCreate`, then read [client] from any [Activity] or `Fragment`.
 *
 * Mirrors the static-client pattern already documented in `packages/android/AGENTS.md` for
 * [com.contentful.optimization.preview.PreviewPanelActivity], extended to cover the whole SDK
 * rather than just the preview panel.
 */
object OptimizationManager {

    private val clientRef = AtomicReference<OptimizationClient?>(null)
    private val previewClientRef = AtomicReference<PreviewContentfulClient?>(null)

    /** Default applied to [OptimizedEntryView.trackViews] when the per-view value is null. */
    @Volatile
    var trackViews: Boolean = true
        private set

    /** Default applied to [OptimizedEntryView.trackTaps] when the per-view value is null. */
    @Volatile
    var trackTaps: Boolean = false
        private set

    /** Default applied to [OptimizedEntryView.liveUpdates] when the per-view value is null. */
    @Volatile
    var liveUpdates: Boolean = false
        private set

    private val initScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /**
     * The live [OptimizationClient]. Call [initialize] before reading this, or it throws.
     *
     * The same error message is used as `LocalOptimizationClient`'s default value on the Compose
     * side so cross-implementation diagnostics line up.
     */
    val client: OptimizationClient
        get() = clientRef.get()
            ?: error(
                "No OptimizationClient provided. Call OptimizationManager.initialize() in your " +
                    "Application.onCreate before reading OptimizationManager.client.",
            )

    /**
     * Construct and initialize the [OptimizationClient]. Idempotent — subsequent calls update
     * the global tracking defaults and preview-panel client but do not recreate the underlying
     * client.
     */
    fun initialize(
        context: Context,
        config: OptimizationConfig,
        trackViews: Boolean = true,
        trackTaps: Boolean = false,
        liveUpdates: Boolean = false,
        previewPanel: PreviewPanelConfig? = null,
    ) {
        this.trackViews = trackViews
        this.trackTaps = trackTaps
        this.liveUpdates = liveUpdates
        previewClientRef.set(previewPanel?.contentfulClient)

        if (clientRef.get() != null) return

        val newClient = OptimizationClient(context.applicationContext)
        clientRef.set(newClient)
        initScope.launch {
            try {
                newClient.initialize(config)
            } catch (_: Exception) {
                // Initialization failures surface through `client.isInitialized` staying false;
                // callers that observe state handle this the same way as the Compose path.
            }
        }
    }

    /**
     * Attach the preview-panel floating action button to [activity]. Returns null when the
     * preview panel is disabled in the active [PreviewPanelConfig] or when [initialize] has not
     * been called. Mirrors [com.contentful.optimization.compose.OptimizationRoot]'s
     * `previewPanel` parameter, which inserts the same overlay on the Compose side.
     */
    fun attachPreviewPanel(activity: Activity): View? {
        val c = clientRef.get() ?: return null
        return PreviewPanelActivity.addFloatingButton(
            activity = activity,
            client = c,
            contentfulClient = previewClientRef.get(),
        )
    }

    /**
     * Tear down for testing or hot-reloads. Production apps don't normally call this.
     */
    fun resetForTesting() {
        clientRef.getAndSet(null)?.let { c ->
            runBlocking(Dispatchers.Default) {
                try {
                    c.destroy()
                } catch (_: Exception) {
                }
            }
        }
        initScope.coroutineContext.cancelChildren()
        previewClientRef.set(null)
    }
}
