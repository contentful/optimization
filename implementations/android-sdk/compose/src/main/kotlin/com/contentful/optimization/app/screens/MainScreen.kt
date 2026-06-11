package com.contentful.optimization.app.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.contentful.optimization.shared.AppConfig
import com.contentful.optimization.shared.ContentfulFetcher
import com.contentful.optimization.shared.EventStore
import com.contentful.optimization.app.components.AnalyticsEventDisplay
import com.contentful.optimization.app.components.ContentEntryView
import com.contentful.optimization.app.components.NestedContentEntryView
import com.contentful.optimization.app.components.isNestedContent
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.LocalScrollContext
import com.contentful.optimization.compose.ScrollContext
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun MainScreen() {
    val client = LocalOptimizationClient.current
    val state by client.state.collectAsState()
    val scope = rememberCoroutineScope()

    var entries by remember { mutableStateOf<List<Map<String, Any>>>(emptyList()) }
    var showNavigationTest by remember { mutableStateOf(false) }
    var showLiveUpdatesTest by remember { mutableStateOf(false) }
    var flagSubscribed by remember { mutableStateOf(false) }
    var viewportHeight by remember { mutableStateOf(0f) }

    LaunchedEffect(Unit) {
        EventStore.subscribe(client.events, scope)
        client.consent(true)
        try { client.page(mapOf("url" to "app")) } catch (_: Exception) {}
    }

    val profileKey = remember(state.profile) {
        state.profile?.let {
            try { JSONObject(it).toString() } catch (_: Exception) { it.hashCode().toString() }
        }
    }

    val isIdentified = remember(state.profile) {
        @Suppress("UNCHECKED_CAST")
        val traits = state.profile?.get("traits") as? Map<String, Any>
        traits?.get("identified") == true
    }

    LaunchedEffect(profileKey) {
        if (state.profile != null) {
            entries = ContentfulFetcher.fetchEntries(
                AppConfig.entryIds,
                AppConfig.defaultContentfulLocale,
            )
            if (!flagSubscribed) {
                flagSubscribed = true
                client.subscribeToFlag("boolean")
            }
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
    
                val scrollContext = remember(viewportHeight) {
                    ScrollContext(scrollY = 0f, viewportHeight = viewportHeight)
                }
                CompositionLocalProvider(LocalScrollContext provides scrollContext) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .onGloballyPositioned { viewportHeight = it.size.height.toFloat() },
                    ) {
                        Column(
                            modifier = Modifier
                                .testTag("main-scroll-view")
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState()),
                        ) {
                            entries.forEach { entry ->
                                if (isNestedContent(entry)) {
                                    NestedContentEntryView(entry = entry)
                                } else {
                                    ContentEntryView(entry = entry)
                                }
                            }
                            AnalyticsEventDisplay()
                        }
                    }
                }
            }
        }
    }
}
