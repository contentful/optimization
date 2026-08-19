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
fun ContentEntryView(entry: CTEntry) {
    val entryId = entry.id ?: ""

    OptimizedEntry(
        entry = entry.toMap(),
        accessibilityIdentifier = "content-entry-$entryId",
    ) { resolvedEntry ->
        EntryContent(entry = CTEntry.from(resolvedEntry), entryId = entryId)
    }
}

@Composable
private fun EntryContent(entry: CTEntry, entryId: String) {
    val client = LocalOptimizationClient.current
    // CTEntry has no structural equals, so key on its Map form: this mirrors the
    // resolved-content-sensitive keying the previous Map-based implementation relied
    // on, e.g. re-resolving merge-tag text after an identify() call changes the
    // profile even when the entry's own sys.id is unchanged.
    val entryMap = entry.toMap()
    var text by remember(entryMap) { mutableStateOf("No content") }
    LaunchedEffect(entryMap) {
        text = RichText.resolveText(entry.getField<Any>("text"), client)
    }

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
