package com.contentful.optimization.app.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.contentful.optimization.app.AppConfig
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.OptimizedEntry

@Composable
fun ContentEntryView(entry: Map<String, Any>) {
    val entryId = entryId(entry)

    OptimizedEntry(
        entry = entry,
        trackTaps = true,
        accessibilityIdentifier = "content-entry-$entryId",
    ) { resolvedEntry ->
        EntryContent(entry = resolvedEntry, entryId = entryId)
    }
}

@Composable
private fun EntryContent(entry: Map<String, Any>, entryId: String) {
    val client = LocalOptimizationClient.current
    @Suppress("UNCHECKED_CAST")
    val fields = entry["fields"] as? Map<String, Any>
    var text by remember(entry) { mutableStateOf("No content") }
    LaunchedEffect(entry) {
        text = RichText.resolveText(fields?.get("text"), client)
    }

    Column(
        modifier = Modifier
            .heightIn(min = AppConfig.contentEntryMinHeightDp.dp)
            .padding(16.dp)
            .testTag("entry-text-$entryId")
            .semantics(mergeDescendants = true) {
                contentDescription = "$text [Entry: $entryId]"
            },
    ) {
        Text(text)
        Text("[Entry: $entryId]")
    }
}

@Suppress("UNCHECKED_CAST")
internal fun entryId(entry: Map<String, Any>): String {
    val sys = entry["sys"] as? Map<String, Any>
    return sys?.get("id") as? String ?: ""
}
