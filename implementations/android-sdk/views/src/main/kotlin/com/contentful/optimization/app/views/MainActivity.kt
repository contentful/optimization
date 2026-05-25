package com.contentful.optimization.app.views

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.contentful.optimization.app.views.components.AnalyticsEventDisplayBinder
import com.contentful.optimization.app.views.components.ContentEntryViewBinder
import com.contentful.optimization.app.views.components.NestedContentEntryViewBinder
import com.contentful.optimization.app.views.components.isNestedContent
import com.contentful.optimization.app.views.support.setTestTag
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.preview.PreviewPanelConfig
import com.contentful.optimization.shared.AppConfig
import com.contentful.optimization.shared.ContentfulFetcher
import com.contentful.optimization.shared.EventStore
import com.contentful.optimization.shared.MockPreviewContentfulClient
import com.contentful.optimization.views.OptimizationManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * View-based counterpart of the Compose `MainScreen` + `MainActivity` pairing.
 *
 * Hosts the entry list, the action row (Identify/Reset, Navigation Test, Live Updates Test), and
 * the analytics-events display. Mirrors the Compose path so the existing UI Automator tests
 * (which look up `By.res("identify-button")`, `By.res("main-scroll-view")`, etc.) work unchanged.
 */
class MainActivity : AppCompatActivity() {

    private val client get() = OptimizationManager.client

    private lateinit var identifyButton: Button
    private lateinit var resetButton: Button
    private lateinit var navigationTestButton: Button
    private lateinit var liveUpdatesTestButton: Button
    private lateinit var scrollView: View
    private lateinit var entriesContainer: LinearLayout
    private lateinit var loadingIndicator: TextView

    private var analyticsDisplayBinder: AnalyticsEventDisplayBinder? = null
    private var isIdentified: Boolean = false
    private var entriesLoaded: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent.getBooleanExtra("reset", false)) {
            getSharedPreferences("com.contentful.optimization", Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
        }
        val simulateOffline = intent.getBooleanExtra("simulate_offline", false)

        // Initialize the SDK after the reset check so a `--ez reset true` cold start clears the
        // persisted profile before the bridge reads it. OptimizationManager.initialize is
        // idempotent across activities, so launching NavigationTestActivity / LiveUpdatesTestActivity
        // before MainActivity's onCreate has finished is still safe.
        OptimizationManager.initialize(
            context = this,
            config = OptimizationConfig(
                clientId = AppConfig.clientId,
                environment = AppConfig.environment,
                experienceBaseUrl = AppConfig.experienceBaseUrl,
                insightsBaseUrl = AppConfig.insightsBaseUrl,
                debug = true,
            ),
            trackViews = true,
            trackTaps = true,
            previewPanel = PreviewPanelConfig(
                contentfulClient = MockPreviewContentfulClient(),
            ),
        )

        setContentView(R.layout.activity_main)

        identifyButton = findViewById(R.id.identify_button)
        resetButton = findViewById(R.id.reset_button)
        navigationTestButton = findViewById(R.id.navigation_test_button)
        liveUpdatesTestButton = findViewById(R.id.live_updates_test_button)
        scrollView = findViewById(R.id.main_scroll_view)
        entriesContainer = findViewById(R.id.entries_container)
        loadingIndicator = findViewById(R.id.loading_indicator)

        // testTags must match the Compose `Modifier.testTag(...)` strings byte-for-byte so the
        // shared UI Automator suite resolves them identically across both apps.
        identifyButton.setTestTag("identify-button")
        resetButton.setTestTag("reset-button")
        navigationTestButton.setTestTag("navigation-test-button")
        liveUpdatesTestButton.setTestTag("live-updates-test-button")
        scrollView.setTestTag("main-scroll-view")

        identifyButton.setOnClickListener { handleIdentify() }
        resetButton.setOnClickListener { handleReset() }
        navigationTestButton.setOnClickListener {
            startActivity(Intent(this, NavigationTestActivity::class.java))
        }
        liveUpdatesTestButton.setOnClickListener {
            startActivity(Intent(this, LiveUpdatesTestActivity::class.java))
        }

        // Mirrors MainScreen.LaunchedEffect(Unit): subscribe events, consent, page, optional
        // offline. The Compose impl gates rendering on `client.isInitialized` via
        // OptimizationRoot, so its content's LaunchedEffects always see an initialized client.
        // The Views impl renders immediately, so we wait for init here before driving the SDK —
        // otherwise consent/page silently no-op and the profile state flow never advances.
        EventStore.subscribe(client.events, lifecycleScope)
        lifecycleScope.launch {
            client.isInitialized.first { it }
            client.consent(true)
            try {
                client.page(mapOf("url" to "app"))
            } catch (_: Exception) {
            }
            if (simulateOffline) {
                client.setOnline(false)
            }
            // Attach the preview-panel floating action button once the client is initialized.
            // Mirrors OptimizationRoot's `previewPanel = PreviewPanelConfig(...)` parameter on
            // the Compose side, which adds the FAB through PreviewPanelOverlay. The FAB needs
            // an initialized client to look up the contentful preview client wired in via
            // OptimizationManager.initialize.
            OptimizationManager.attachPreviewPanel(this@MainActivity)
        }

        observeProfileForEntries()
    }

    private fun observeProfileForEntries() {
        lifecycleScope.launch {
            client.state.collect { state ->
                val profile = state.profile
                val identified =
                    @Suppress("UNCHECKED_CAST")
                    (profile?.get("traits") as? Map<String, Any>)?.get("identified") == true
                updateIdentifiedUI(identified)

                if (profile == null) return@collect

                // Fetch + render entries exactly once per Activity lifetime. Subsequent profile
                // emissions (consent updates, identify, etc.) flow through the SDK and update
                // personalizations on existing OptimizedEntryView instances; recreating the
                // entry list here would tear down view-tracking controllers mid-dwell and miss
                // component events, which doesn't happen on the Compose side because Compose's
                // diffing keeps existing nodes when the data is identical.
                if (entriesLoaded) return@collect
                entriesLoaded = true
                client.subscribeToFlag("boolean")
                val entries = ContentfulFetcher.fetchEntries(AppConfig.entryIds)
                renderEntries(entries)
            }
        }
    }

    private fun updateIdentifiedUI(identified: Boolean) {
        if (identified == isIdentified) return
        isIdentified = identified
        identifyButton.visibility = if (identified) View.GONE else View.VISIBLE
        resetButton.visibility = if (identified) View.VISIBLE else View.GONE
    }

    private fun handleIdentify() {
        // Activity render is not gated on isInitialized, so the user can tap Identify before
        // the bridge finishes booting. client.identify requires an initialized client and would
        // otherwise throw + get caught silently here, leaving the UI stuck on the Identify state.
        lifecycleScope.launch {
            client.isInitialized.first { it }
            try {
                client.identify(
                    userId = "charles",
                    traits = mapOf("identified" to true),
                )
            } catch (_: Exception) {
            }
        }
    }

    private fun handleReset() {
        lifecycleScope.launch {
            client.isInitialized.first { it }
            client.reset()
            try {
                client.page(mapOf("url" to "app"))
            } catch (_: Exception) {
            }
        }
    }

    private fun renderEntries(entries: List<Map<String, Any>>) {
        if (entries.isEmpty()) {
            loadingIndicator.visibility = View.VISIBLE
            return
        }
        loadingIndicator.visibility = View.GONE
        entriesContainer.removeAllViews()

        entries.forEach { entry ->
            val child = if (isNestedContent(entry)) {
                NestedContentEntryViewBinder.create(this, entry)
            } else {
                ContentEntryViewBinder.create(this, entry)
            }
            entriesContainer.addView(child)
        }

        // Analytics events display lives at the end of the scrollable content, matching the
        // Compose Column layout that places AnalyticsEventDisplay after the entries.
        val analyticsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        entriesContainer.addView(analyticsContainer)
        val binder = AnalyticsEventDisplayBinder(this, analyticsContainer)
        binder.attach(lifecycleScope)
        analyticsDisplayBinder = binder
    }
}
