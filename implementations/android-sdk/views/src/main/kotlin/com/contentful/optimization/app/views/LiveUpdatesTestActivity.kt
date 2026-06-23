package com.contentful.optimization.app.views

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.contentful.optimization.app.views.support.setTestTag
import com.contentful.optimization.shared.AppConfig
import com.contentful.optimization.shared.ContentfulFetcher
import com.contentful.optimization.views.OptimizationManager
import com.contentful.optimization.views.OptimizedEntryView
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * View-based counterpart of `LiveUpdatesTestScreen`.
 *
 * Holds three [OptimizedEntryView] slots that exercise the three live-update modes
 * (default / live / locked), plus the toggle controls and status labels the existing
 * `LiveUpdatesTests` UI Automator suite asserts against.
 */
class LiveUpdatesTestActivity : AppCompatActivity() {

    private val client get() = OptimizationManager.client

    private lateinit var closeButton: Button
    private lateinit var identifyButton: Button
    private lateinit var resetButton: Button
    private lateinit var toggleGlobalButton: Button
    private lateinit var simulatePreviewButton: Button

    private lateinit var identifiedStatus: TextView
    private lateinit var globalStatus: TextView
    private lateinit var previewPanelStatus: TextView

    private lateinit var defaultSlot: OptimizedEntryView
    private lateinit var liveSlot: OptimizedEntryView
    private lateinit var lockedSlot: OptimizedEntryView

    private var globalLiveUpdates = false
    private var isPreviewPanelSimulated = false
    private var isIdentified = false
    private var loadedEntry: Map<String, Any>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_live_updates_test)

        bindViews()
        applyTestTags()
        wireButtons()

        // Compose's LiveUpdatesTestScreen is mounted/unmounted within a single Activity, so the
        // bridge's preview-panel flag and the locked state of OptimizedEntry composables reset
        // naturally between visits via Compose's `key(..., isPreviewPanelSimulated)` block. The
        // Views impl is a separate Activity reused across UI Automator test cases, so we
        // explicitly close the SDK preview panel here to mirror that fresh-start contract.
        // Without this, a prior test that toggled the panel can leave it open in the bridge,
        // which forces shouldLive=true for the locked slots in the next test and breaks the
        // "locked must not update after identify" assertions.
        OptimizationManager.client.setPreviewPanelOpen(false)

        loadEntry()
    }

    private fun bindViews() {
        closeButton = findViewById(R.id.close_live_updates_test_button)
        identifyButton = findViewById(R.id.live_updates_identify_button)
        resetButton = findViewById(R.id.live_updates_reset_button)
        toggleGlobalButton = findViewById(R.id.toggle_global_live_updates_button)
        simulatePreviewButton = findViewById(R.id.simulate_preview_panel_button)

        identifiedStatus = findViewById(R.id.identified_status)
        globalStatus = findViewById(R.id.global_live_updates_status)
        previewPanelStatus = findViewById(R.id.preview_panel_status)

        defaultSlot = findViewById(R.id.default_slot)
        liveSlot = findViewById(R.id.live_slot)
        lockedSlot = findViewById(R.id.locked_slot)
    }

    private fun applyTestTags() {
        findViewById<View>(R.id.live_updates_scroll_view).setTestTag("live-updates-scroll-view")
        closeButton.setTestTag("close-live-updates-test-button")
        identifyButton.setTestTag("live-updates-identify-button")
        resetButton.setTestTag("live-updates-reset-button")
        toggleGlobalButton.setTestTag("toggle-global-live-updates-button")
        simulatePreviewButton.setTestTag("simulate-preview-panel-button")

        identifiedStatus.setTestTag("identified-status")
        globalStatus.setTestTag("global-live-updates-status")
        previewPanelStatus.setTestTag("preview-panel-status")

        defaultSlot.accessibilityIdentifier = "default-personalization"
        liveSlot.accessibilityIdentifier = "live-personalization"
        lockedSlot.accessibilityIdentifier = "locked-personalization"
    }

    private fun wireButtons() {
        closeButton.setOnClickListener { finish() }
        identifyButton.setOnClickListener { handleIdentify() }
        resetButton.setOnClickListener { handleReset() }
        toggleGlobalButton.setOnClickListener { toggleGlobalLiveUpdates() }
        simulatePreviewButton.setOnClickListener { togglePreviewPanelSimulation() }
    }

    private fun loadEntry() {
        lifecycleScope.launch {
            // Wait for the SDK to populate selectedOptimizations before mounting any
            // OptimizedEntryView. Compose renders LiveUpdatesTestScreen inside the same
            // Activity as MainScreen, so by the time the user taps the test button, the
            // bridge has already emitted a non-null optimizations value and the screen's
            // `liveUpdates = false` slots lock onto a variant on their first collect. The
            // Views impl uses a separate Activity, and without this gate the slots see the
            // initial `null` emission first and publish baseline content, then lock onto the
            // variant on the second emission — the test then sees the entry id change after
            // identify even though the slot is supposedly locked.
            OptimizationManager.client.selectedOptimizations.first { it != null }
            val entries = ContentfulFetcher.fetchEntries(
                listOf("2Z2WLOx07InSewC3LUB3eX"),
                AppConfig.defaultContentfulLocale,
            )
            loadedEntry = entries.firstOrNull() ?: return@launch
            attachSlotRenderers()
            renderSlots()
        }
    }

    private fun attachSlotRenderers() {
        defaultSlot.setContentRenderer { resolvedEntry ->
            renderEntryDisplay(resolvedEntry, prefix = "default")
        }
        liveSlot.setContentRenderer { resolvedEntry ->
            renderEntryDisplay(resolvedEntry, prefix = "live")
        }
        lockedSlot.setContentRenderer { resolvedEntry ->
            renderEntryDisplay(resolvedEntry, prefix = "locked")
        }
    }

    private fun renderSlots() {
        val entry = loadedEntry ?: return

        // Match the Compose semantics: default slot inherits the global setting, the live and
        // locked slots pin explicitly. Passing `liveUpdates = null` to the default slot leaves
        // it free to fall back to OptimizationManager.liveUpdates — but the global toggle here
        // is a per-screen value, not a global SDK default. So we feed the screen's
        // globalLiveUpdates into the default slot explicitly.
        defaultSlot.liveUpdates = globalLiveUpdates
        defaultSlot.setEntry(entry)

        liveSlot.liveUpdates = true
        liveSlot.setEntry(entry)

        lockedSlot.liveUpdates = false
        lockedSlot.setEntry(entry)
    }

    private fun renderEntryDisplay(entry: Map<String, Any>, prefix: String): View {
        @Suppress("UNCHECKED_CAST")
        val fields = entry["fields"] as? Map<String, Any>
        val text = fields?.get("text") as? String ?: "No content"

        @Suppress("UNCHECKED_CAST")
        val sys = entry["sys"] as? Map<String, Any>
        val entryId = sys?.get("id") as? String ?: ""

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setTestTag("$prefix-container")
        }

        column.addView(
            TextView(this).apply {
                this.text = text
                contentDescription = text
                setTestTag("$prefix-text")
            },
        )
        val entryLabel = "Entry: $entryId"
        column.addView(
            TextView(this).apply {
                this.text = entryLabel
                contentDescription = entryLabel
                setTestTag("$prefix-entry-id")
            },
        )
        return column
    }

    private fun handleIdentify() {
        lifecycleScope.launch {
            try {
                client.identify(
                    userId = "charles",
                    traits = mapOf("identified" to true),
                )
            } catch (_: Exception) {
            }
            isIdentified = true
            applyIdentifiedUI()
        }
    }

    private fun handleReset() {
        client.reset()
        lifecycleScope.launch {
            try {
                client.page(mapOf("url" to "live-updates-test"))
            } catch (_: Exception) {
            }
            isIdentified = false
            applyIdentifiedUI()
        }
    }

    private fun applyIdentifiedUI() {
        identifyButton.visibility = if (isIdentified) View.GONE else View.VISIBLE
        resetButton.visibility = if (isIdentified) View.VISIBLE else View.GONE
        val label = if (isIdentified) "Yes" else "No"
        identifiedStatus.text = label
        identifiedStatus.contentDescription = label
    }

    private fun toggleGlobalLiveUpdates() {
        globalLiveUpdates = !globalLiveUpdates
        toggleGlobalButton.text = if (globalLiveUpdates) "Global: ON" else "Global: OFF"
        val label = if (globalLiveUpdates) "ON" else "OFF"
        globalStatus.text = label
        globalStatus.contentDescription = label
        // Restart the default slot so the new global setting takes effect mid-screen, mirroring
        // the Compose `key(globalLiveUpdates, ...)` recomposition.
        loadedEntry?.let {
            defaultSlot.liveUpdates = globalLiveUpdates
            defaultSlot.setEntry(it)
        }
    }

    private fun togglePreviewPanelSimulation() {
        isPreviewPanelSimulated = !isPreviewPanelSimulated
        simulatePreviewButton.text =
            if (isPreviewPanelSimulated) "Close Preview Panel" else "Simulate Preview Panel"
        val label = if (isPreviewPanelSimulated) "Open" else "Closed"
        previewPanelStatus.text = label
        previewPanelStatus.contentDescription = label
        // Drive the SDK preview-panel flag so the OptimizedEntryView observation loop switches
        // every slot — including the locked one — into live-update mode while open. Matches
        // the Compose path's `client.setPreviewPanelOpen(...)` call.
        client.setPreviewPanelOpen(isPreviewPanelSimulated)
    }
}
