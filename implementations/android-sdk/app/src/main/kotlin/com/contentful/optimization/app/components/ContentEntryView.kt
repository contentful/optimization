package com.contentful.optimization.app.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
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
    @Suppress("UNCHECKED_CAST")
    val fields = entry["fields"] as? Map<String, Any>
    val text = fields?.get("text") as? String ?: "No content"

    Column(
        modifier = Modifier
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
