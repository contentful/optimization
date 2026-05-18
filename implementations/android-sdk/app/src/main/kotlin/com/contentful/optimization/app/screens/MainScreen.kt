package com.contentful.optimization.app.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.contentful.optimization.app.AppConfig
import com.contentful.optimization.app.ContentfulFetcher
import com.contentful.optimization.app.components.AnalyticsEventDisplay
import com.contentful.optimization.app.components.ContentEntryView
import com.contentful.optimization.app.components.NestedContentEntryView
import com.contentful.optimization.app.components.isNestedContent
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.OptimizationLazyColumn
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun MainScreen(simulateOffline: Boolean = false) {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val scope = rememberCoroutineScope()

    var entries by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var isIdentified by remember { mutableStateOf(false) }
    var showNavigationTest by remember { mutableStateOf(false) }
    var showLiveUpdatesTest by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        client.consent(true)
        try { client.page(mapOf("url" to "app")) } catch (_: Exception) {}
        if (simulateOffline) {
            client.setOnline(false)
        }
    }

    val profileKey = remember(state.profile) {
        state.profile?.let {
            try { JSONObject(it).toString() } catch (_: Exception) { it.hashCode().toString() }
        }
    }

    LaunchedEffect(profileKey) {
        if (state.profile != null) {
            entries = ContentfulFetcher.fetchEntries(AppConfig.entryIds)
        }
    }

    if (showNavigationTest) {
        NavigationTestScreen(onClose = { showNavigationTest = false })
    } else if (showLiveUpdatesTest) {
        LiveUpdatesTestScreen(onClose = { showLiveUpdatesTest = false })
    } else {
        Column {
            Row(modifier = Modifier.padding(8.dp)) {
                if (!isIdentified) {
                    Button(
                        onClick = {
                            isIdentified = true
                            scope.launch {
                                try {
                                    client.identify(
                                        userId = "charles",
                                        traits = mapOf("identified" to true),
                                    )
                                } catch (_: Exception) {}
                            }
                        },
                        modifier = Modifier.testTag("identify-button"),
                    ) { Text("Identify") }
                } else {
                    Button(
                        onClick = {
                            client.reset()
                            isIdentified = false
                            scope.launch {
                                try { client.page(mapOf("url" to "app")) } catch (_: Exception) {}
                            }
                        },
                        modifier = Modifier.testTag("reset-button"),
                    ) { Text("Reset") }
                }
                Button(
                    onClick = { showNavigationTest = true },
                    modifier = Modifier.testTag("navigation-test-button"),
                ) { Text("Navigation Test") }
                Button(
                    onClick = { showLiveUpdatesTest = true },
                    modifier = Modifier.testTag("live-updates-test-button"),
                ) { Text("Live Updates Test") }
            }

            if (entries.isEmpty()) {
                Text("Loading...")
            } else {
                OptimizationLazyColumn(
                    modifier = Modifier.testTag("main-scroll-view"),
                ) {
                    items(entries.size) { index ->
                        val entry = entries[index]
                        if (isNestedContent(entry)) {
                            NestedContentEntryView(entry = entry)
                        } else {
                            ContentEntryView(entry = entry)
                        }
                    }
                    item {
                        AnalyticsEventDisplay()
                    }
                }
            }
        }
    }
}
