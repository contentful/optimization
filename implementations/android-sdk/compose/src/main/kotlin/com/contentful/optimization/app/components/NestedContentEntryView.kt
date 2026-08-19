package com.contentful.optimization.app.components

import androidx.compose.foundation.layout.Column
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
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.compose.OptimizedEntry
import com.contentful.optimization.contentful.CTEntry
import com.contentful.optimization.shared.RichText

@Composable
fun NestedContentEntryView(entry: CTEntry) {
    val entryId = entry.id ?: ""

    val nestedEntries = entry.getField<List<Map<String, Any>>>("nested")
        .orEmpty()
        .map(CTEntry::from)
        .filter { it.id != null }

    Column {
        OptimizedEntry(
            entry = entry.toMap(),
            accessibilityIdentifier = "content-entry-$entryId",
        ) { resolvedEntry ->
            NestedEntryText(entry = CTEntry.from(resolvedEntry))
        }

        nestedEntries.forEach { nestedEntry ->
            NestedContentEntryView(entry = nestedEntry)
        }
    }
}

@Composable
private fun NestedEntryText(entry: CTEntry) {
    val id = entry.id ?: ""
    val client = LocalOptimizationClient.current
    // CTEntry has no structural equals, so key on its Map form (see ContentEntryView).
    val entryMap = entry.toMap()
    var text by remember(entryMap) { mutableStateOf("No content") }
    LaunchedEffect(entryMap) {
        text = RichText.resolveText(entry.getField<Any>("text"), client)
    }

    Column(
        modifier = Modifier
            .padding(16.dp)
            .testTag("entry-text-$id")
            .semantics(mergeDescendants = true) {
                contentDescription = "$text [Entry: $id]"
            },
    ) {
        Text(text)
        Text("[Entry: $id]")
    }
}

fun isNestedContent(entry: CTEntry): Boolean = entry.contentTypeId == "nestedContent"
