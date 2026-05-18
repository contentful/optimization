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
fun NestedContentEntryView(entry: Map<String, Any>) {
    val entryId = entryId(entry)

    @Suppress("UNCHECKED_CAST")
    val fields = entry["fields"] as? Map<String, Any>
    val nestedArray = fields?.get("nested") as? List<*> ?: emptyList<Any>()

    @Suppress("UNCHECKED_CAST")
    val nestedEntries = nestedArray.filterIsInstance<Map<String, Any>>().filter { item ->
        val sys = item["sys"] as? Map<String, Any>
        sys?.get("id") != null
    }

    Column {
        OptimizedEntry(
            entry = entry,
            accessibilityIdentifier = "content-entry-$entryId",
        ) { resolvedEntry ->
            NestedEntryText(entry = resolvedEntry)
        }

        nestedEntries.forEach { nestedEntry ->
            NestedContentEntryView(entry = nestedEntry)
        }
    }
}

@Composable
private fun NestedEntryText(entry: Map<String, Any>) {
    val id = entryId(entry)
    @Suppress("UNCHECKED_CAST")
    val fields = entry["fields"] as? Map<String, Any>
    val text = fields?.get("text") as? String ?: "No content"

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

@Suppress("UNCHECKED_CAST")
fun isNestedContent(entry: Map<String, Any>): Boolean {
    val sys = entry["sys"] as? Map<String, Any> ?: return false
    val contentType = sys["contentType"] as? Map<String, Any> ?: return false
    val innerSys = contentType["sys"] as? Map<String, Any> ?: return false
    val id = innerSys["id"] as? String ?: return false
    return id == "nestedContent"
}
