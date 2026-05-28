package com.contentful.optimization.app.views.components

import android.content.Context
import android.graphics.Typeface
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import com.contentful.optimization.app.views.support.setTestTag
import com.contentful.optimization.shared.EventStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

/**
 * View-based counterpart of `AnalyticsEventDisplay` from the Compose reference impl.
 *
 * Renders the analytics events list and per-component statistics into a [LinearLayout]. The
 * subscriptions to [EventStore.events] and [EventStore.componentStats] survive for the lifetime
 * of the supplied [CoroutineScope] passed to [attach].
 */
class AnalyticsEventDisplayBinder(
    private val context: Context,
    private val container: LinearLayout,
) {
    private val headerLabel = TextView(context).apply {
        text = "Analytics Events"
        setTypeface(typeface, Typeface.BOLD)
    }
    private val eventsCount = TextView(context).apply {
        setTestTag("events-count")
    }
    private val emptyMessage = TextView(context).apply {
        text = "No events tracked yet"
        setTestTag("no-events-message")
        contentDescription = "No events tracked yet"
    }
    private val eventsList = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }
    private val statsList = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }

    init {
        val padding = context.dp(16)
        container.apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            setTestTag("analytics-events-container")
        }
        container.addView(headerLabel)
        container.addView(eventsCount)
        container.addView(emptyMessage)
        container.addView(eventsList)
        container.addView(statsList)
    }

    fun attach(scope: CoroutineScope) {
        scope.launch {
            // Combine the two flows so the UI only updates once per state change tuple, matching
            // Compose's `collectAsState` semantics where both `events` and `componentStats`
            // recompose the same composable.
            EventStore.events.combine(EventStore.componentStats) { events, stats -> events to stats }
                .collect { (events, stats) -> render(events, stats) }
        }
    }

    private fun render(
        events: List<EventStore.AnalyticsEvent>,
        stats: Map<String, EventStore.ComponentStats>,
    ) {
        val countText = "Events: ${events.size}"
        eventsCount.text = countText
        eventsCount.contentDescription = countText

        emptyMessage.visibility = if (events.isEmpty()) View.VISIBLE else View.GONE

        eventsList.removeAllViews()
        val nonComponent = events.filter { it.type != "component" }
        nonComponent.forEachIndexed { index, event ->
            val testId = if (event.componentId != null) {
                "event-${event.type}-${event.componentId}"
            } else {
                "event-${event.type}-$index"
            }
            val desc = buildString {
                append(event.type)
                event.componentId?.let { append(" - Component: $it") }
                event.viewDurationMs?.let { append(" - ${it}ms") }
            }
            val row = TextView(context).apply {
                text = desc
                contentDescription = desc
                setTestTag(testId)
            }
            eventsList.addView(row)
        }

        statsList.removeAllViews()
        stats.keys.sorted().forEach { cid ->
            val s = stats[cid] ?: return@forEach
            val block = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setTestTag("component-stats-$cid")
            }

            val countLine = "Count: ${s.count}"
            block.addView(
                TextView(context).apply {
                    text = countLine
                    contentDescription = countLine
                    setTestTag("event-count-$cid")
                },
            )

            val durationLine = "Duration: ${s.latestViewDurationMs?.toString() ?: "N/A"}"
            block.addView(
                TextView(context).apply {
                    text = durationLine
                    contentDescription = durationLine
                    setTestTag("event-duration-$cid")
                },
            )

            val viewIdLine = "ViewId: ${s.latestViewId ?: "N/A"}"
            block.addView(
                TextView(context).apply {
                    text = viewIdLine
                    contentDescription = viewIdLine
                    setTestTag("event-view-id-$cid")
                },
            )

            statsList.addView(block)
        }
    }
}
