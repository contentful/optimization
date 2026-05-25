package com.contentful.optimization.app.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.contentful.optimization.shared.EventStore

@Composable
fun AnalyticsEventDisplay() {
    val events by EventStore.events.collectAsState()
    val componentStats by EventStore.componentStats.collectAsState()

    Column(
        modifier = Modifier
            .padding(16.dp)
            .testTag("analytics-events-container"),
    ) {
        Text("Analytics Events", fontWeight = FontWeight.Bold)

        val eventsCountText = "Events: ${events.size}"
        Text(
            text = eventsCountText,
            modifier = Modifier
                .testTag("events-count")
                .semantics { contentDescription = eventsCountText },
        )

        if (events.isEmpty()) {
            val noEventsText = "No events tracked yet"
            Text(
                text = noEventsText,
                modifier = Modifier
                    .testTag("no-events-message")
                    .semantics { contentDescription = noEventsText },
            )
        } else {
            val nonComponentEvents = events.filter { it.type != "component" }
            nonComponentEvents.forEachIndexed { index, event ->
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
                Text(
                    text = desc,
                    modifier = Modifier
                        .testTag(testId)
                        .semantics { contentDescription = desc },
                )
            }

            componentStats.keys.sorted().forEach { cid ->
                val stats = componentStats[cid] ?: return@forEach
                Column(modifier = Modifier.testTag("component-stats-$cid")) {
                    val countText = "Count: ${stats.count}"
                    Text(
                        text = countText,
                        modifier = Modifier
                            .testTag("event-count-$cid")
                            .semantics { contentDescription = countText },
                    )

                    val durationText = "Duration: ${stats.latestViewDurationMs?.toString() ?: "N/A"}"
                    Text(
                        text = durationText,
                        modifier = Modifier
                            .testTag("event-duration-$cid")
                            .semantics { contentDescription = durationText },
                    )

                    val viewIdText = "ViewId: ${stats.latestViewId ?: "N/A"}"
                    Text(
                        text = viewIdText,
                        modifier = Modifier
                            .testTag("event-view-id-$cid")
                            .semantics { contentDescription = viewIdText },
                    )
                }
            }
        }
    }
}
