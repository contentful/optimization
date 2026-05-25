package com.contentful.optimization.app.views.components

import android.content.Context
import android.view.View
import android.widget.LinearLayout
import com.contentful.optimization.views.OptimizedEntryView

/**
 * Renders a `nestedContent` entry tree: an outer wrapper plus a recursive list of nested entries
 * underneath it. Mirrors `NestedContentEntryView` from the Compose reference impl.
 */
object NestedContentEntryViewBinder {

    fun create(context: Context, entry: Map<String, Any>): View {
        val entryId = entryId(entry)
        val column = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }

        val wrapper = OptimizedEntryView(context).apply {
            accessibilityIdentifier = "content-entry-$entryId"
        }
        wrapper.setContentRenderer { resolvedEntry ->
            ContentEntryViewBinder.renderEntryColumn(context, resolvedEntry, entryId)
        }
        wrapper.setEntry(entry)
        column.addView(wrapper)

        @Suppress("UNCHECKED_CAST")
        val fields = entry["fields"] as? Map<String, Any>
        val nested = (fields?.get("nested") as? List<*>).orEmpty()
        @Suppress("UNCHECKED_CAST")
        nested
            .filterIsInstance<Map<String, Any>>()
            .filter {
                val sys = it["sys"] as? Map<String, Any>
                sys?.get("id") != null
            }
            .forEach { nestedEntry ->
                column.addView(create(context, nestedEntry))
            }

        return column
    }
}

@Suppress("UNCHECKED_CAST")
internal fun isNestedContent(entry: Map<String, Any>): Boolean {
    val sys = entry["sys"] as? Map<String, Any> ?: return false
    val contentType = sys["contentType"] as? Map<String, Any> ?: return false
    val innerSys = contentType["sys"] as? Map<String, Any> ?: return false
    val id = innerSys["id"] as? String ?: return false
    return id == "nestedContent"
}
