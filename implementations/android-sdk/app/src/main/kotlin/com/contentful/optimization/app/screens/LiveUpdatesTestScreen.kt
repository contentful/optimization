package com.contentful.optimization.app.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.contentful.optimization.app.ContentfulFetcher
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.LocalTrackingConfig
import com.contentful.optimization.compose.OptimizationLazyColumn
import com.contentful.optimization.compose.OptimizedEntry
import com.contentful.optimization.compose.TrackingConfig
import kotlinx.coroutines.launch

@Composable
fun LiveUpdatesTestScreen(onClose: () -> Unit) {
    val client = LocalOptimizationClient.current
    val scope = rememberCoroutineScope()

    var entry by remember { mutableStateOf<Map<String, Any>?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isIdentified by remember { mutableStateOf(false) }
    var globalLiveUpdates by remember { mutableStateOf(false) }
    var isPreviewPanelSimulated by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val entries = ContentfulFetcher.fetchEntries(listOf("2Z2WLOx07InSewC3LUB3eX"))
        entry = entries.firstOrNull()
        isLoading = false
    }

    if (isLoading) {
        CircularProgressIndicator()
    } else if (entry != null) {
        val currentEntry = entry!!

        key(globalLiveUpdates, isPreviewPanelSimulated) {
            CompositionLocalProvider(
                LocalTrackingConfig provides TrackingConfig(
                    trackViews = true,
                    trackTaps = false,
                    liveUpdates = globalLiveUpdates,
                ),
            ) {
                OptimizationLazyColumn(
                    modifier = Modifier.testTag("live-updates-scroll-view"),
                ) {
                    item {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.Start,
                        ) {
                            Text("Live Updates Test Controls", fontWeight = FontWeight.Bold)
                            Row {
                                Button(
                                    onClick = onClose,
                                    modifier = Modifier.testTag("close-live-updates-test-button"),
                                ) { Text("Close") }
                                if (!isIdentified) {
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                try {
                                                    client.identify(
                                                        userId = "charles",
                                                        traits = mapOf("identified" to true),
                                                    )
                                                } catch (_: Exception) {}
                                                isIdentified = true
                                            }
                                        },
                                        modifier = Modifier.testTag("live-updates-identify-button"),
                                    ) { Text("Identify") }
                                } else {
                                    Button(
                                        onClick = {
                                            client.reset()
                                            scope.launch {
                                                try {
                                                    client.page(mapOf("url" to "live-updates-test"))
                                                } catch (_: Exception) {}
                                            }
                                            isIdentified = false
                                        },
                                        modifier = Modifier.testTag("live-updates-reset-button"),
                                    ) { Text("Reset") }
                                }
                                Button(
                                    onClick = { globalLiveUpdates = !globalLiveUpdates },
                                    modifier = Modifier.testTag("toggle-global-live-updates-button"),
                                ) { Text("Global: ${if (globalLiveUpdates) "ON" else "OFF"}") }
                            }
                        }
                    }

                    item {
                        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                            Row {
                                Text("Identified: ")
                                val identifiedText = if (isIdentified) "Yes" else "No"
                                Text(
                                    text = identifiedText,
                                    modifier = Modifier
                                        .testTag("identified-status")
                                        .semantics { contentDescription = identifiedText },
                                )
                            }
                            Row {
                                Text("Global Live Updates: ")
                                val globalText = if (globalLiveUpdates) "ON" else "OFF"
                                Text(
                                    text = globalText,
                                    modifier = Modifier
                                        .testTag("global-live-updates-status")
                                        .semantics { contentDescription = globalText },
                                )
                            }
                        }
                    }

                    item {
                        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                            Button(
                                onClick = {
                                    isPreviewPanelSimulated = !isPreviewPanelSimulated
                                    // Drive the SDK preview-panel flag so default/locked
                                    // sections switch to live-update mode while open.
                                    client.setPreviewPanelOpen(isPreviewPanelSimulated)
                                },
                                modifier = Modifier.testTag("simulate-preview-panel-button"),
                            ) {
                                Text(
                                    if (isPreviewPanelSimulated) "Close Preview Panel"
                                    else "Simulate Preview Panel",
                                )
                            }
                            Row {
                                Text("Preview Panel: ")
                                val panelText = if (isPreviewPanelSimulated) "Open" else "Closed"
                                Text(
                                    text = panelText,
                                    modifier = Modifier
                                        .testTag("preview-panel-status")
                                        .semantics { contentDescription = panelText },
                                )
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                            Text("Default Behavior (inherits global setting)")
                            Text(
                                "No liveUpdates prop - inherits from OptimizationRoot (false)",
                                fontSize = 12.sp,
                            )
                            OptimizedEntry(
                                entry = currentEntry,
                                accessibilityIdentifier = "default-personalization",
                            ) { resolvedEntry ->
                                LiveUpdatesEntryDisplay(
                                    entry = resolvedEntry,
                                    prefix = "default",
                                )
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                            Text("Live Updates Enabled (liveUpdates=true)")
                            Text(
                                "Always updates when personalization state changes",
                                fontSize = 12.sp,
                            )
                            OptimizedEntry(
                                entry = currentEntry,
                                liveUpdates = true,
                                accessibilityIdentifier = "live-personalization",
                            ) { resolvedEntry ->
                                LiveUpdatesEntryDisplay(
                                    entry = resolvedEntry,
                                    prefix = "live",
                                )
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                            Text("Locked (liveUpdates=false)")
                            Text(
                                "Never updates - locks to first variant received",
                                fontSize = 12.sp,
                            )
                            OptimizedEntry(
                                entry = currentEntry,
                                liveUpdates = false,
                                accessibilityIdentifier = "locked-personalization",
                            ) { resolvedEntry ->
                                LiveUpdatesEntryDisplay(
                                    entry = resolvedEntry,
                                    prefix = "locked",
                                )
                            }
                        }
                    }
                }
            }
        }
    } else {
        Column {
            Text("No entry found")
            Button(
                onClick = onClose,
                modifier = Modifier.testTag("close-live-updates-test-button"),
            ) { Text("Close") }
        }
    }
}

@Composable
private fun LiveUpdatesEntryDisplay(entry: Map<String, Any>, prefix: String) {
    @Suppress("UNCHECKED_CAST")
    val fields = entry["fields"] as? Map<String, Any>
    val text = fields?.get("text") as? String ?: "No content"

    @Suppress("UNCHECKED_CAST")
    val sys = entry["sys"] as? Map<String, Any>
    val entryId = sys?.get("id") as? String ?: ""

    Column(modifier = Modifier.testTag("$prefix-container")) {
        Text(
            text = text,
            modifier = Modifier
                .testTag("$prefix-text")
                .semantics { contentDescription = text },
        )
        val entryLabel = "Entry: $entryId"
        Text(
            text = entryLabel,
            modifier = Modifier
                .testTag("$prefix-entry-id")
                .semantics { contentDescription = entryLabel },
        )
    }
}
