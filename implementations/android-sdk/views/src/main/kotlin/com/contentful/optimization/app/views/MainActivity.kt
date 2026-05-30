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
import com.contentful.optimization.shared.RichText
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

        // Attach the preview-panel floating button synchronously so it's visible on the same
        // frame as the action row. testFABIsVisible uses a no-wait findObject(By.desc(...)) so
        // the FAB has to be in the accessibility tree by the time the @Before setUp's wait for
        // the identify button returns. The Compose impl gets this for free because
        // OptimizationRoot/PreviewPanelOverlay synthesizes the FAB inside the initial
        // composition. OptimizationManager.attachPreviewPanel only needs the OptimizationClient
        // reference (already non-null after initialize() returns), not the bridge having
        // finished its async initialize() — the FAB tap won't open PreviewPanelActivity until
        // the user actually taps it, by which time init has settled.
        OptimizationManager.attachPreviewPanel(this)

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
                // Pre-resolve each entry's rich text on the (suspending) coroutine
                // path BEFORE handing the entry to the synchronous view binder. This
                // mirrors the iOS pattern where `RichText.resolveText` is a synchronous
                // function (no `await`), so UILabel.text is set at construction time
                // and the view's measured height is stable from the first layout pass.
                // The Views path's previous behavior — async resolution inside an
                // `onViewAttachedToWindow` listener — caused the merge-tag entry's
                // TextView to grow from a "No content" placeholder to its resolved text
                // height (164 → 207 px observed) up to ~1 s after `OptimizedEntryView`
                // had already fired `ViewTrackingController.onBecameVisible` at the
                // smaller height, and that height growth combined with the test's
                // scroll-to-stats swipe dropped the visible ratio below the 0.8
                // threshold, hitting `onBecameInvisible` while `attempts == 0` and
                // resetting the 2s dwell cycle — so the entry's `trackView` event
                // never fired and `component-stats-1MwiFl4z…` never appeared.
                val resolvedBaselineTexts = entries.map { entry ->
                    @Suppress("UNCHECKED_CAST")
                    val fields = entry["fields"] as? Map<String, Any>
                    RichText.resolveText(fields?.get("text"), client)
                }
                renderEntries(entries, resolvedBaselineTexts)
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

    private fun renderEntries(
        entries: List<Map<String, Any>>,
        resolvedBaselineTexts: List<String> = emptyList(),
    ) {
        if (entries.isEmpty()) {
            loadingIndicator.visibility = View.VISIBLE
            return
        }
        loadingIndicator.visibility = View.GONE
        entriesContainer.removeAllViews()

        entries.forEachIndexed { index, entry ->
            val resolvedText = resolvedBaselineTexts.getOrNull(index)
            val child = if (isNestedContent(entry)) {
                NestedContentEntryViewBinder.create(this, entry)
            } else {
                ContentEntryViewBinder.create(this, entry, resolvedText)
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
