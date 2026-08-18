package com.contentful.optimization.app.views.components

import android.content.Context
import android.view.View
import android.widget.LinearLayout
import com.contentful.optimization.contentful.CTEntry
import com.contentful.optimization.views.OptimizedEntryView

/**
 * Renders a `nestedContent` entry tree: an outer wrapper plus a recursive list of nested entries
 * underneath it. Mirrors `NestedContentEntryView` from the Compose reference impl.
 */
object NestedContentEntryViewBinder {

    fun create(context: Context, entry: CTEntry): View {
        val entryId = entry.id ?: ""
        val column = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }

        val wrapper = OptimizedEntryView(context).apply {
            accessibilityIdentifier = "content-entry-$entryId"
        }
        wrapper.setContentRenderer { resolvedMap ->
            // Compose's NestedEntryText derives the test tag id from the RESOLVED entry, so the
            // personalization variant's sys.id becomes the test tag (e.g.
            // `entry-text-2KIWllNZJT205BwOSkMINg` for the nested return-visitor variant). The
            // outer OptimizedEntryView's accessibilityIdentifier stays on the BASE id to match
            // the non-nested path.
            val resolvedEntry = CTEntry.from(resolvedMap)
            val resolvedId = resolvedEntry.id ?: ""
            ContentEntryViewBinder.renderEntryColumn(context, resolvedEntry, resolvedId)
        }
        wrapper.setEntry(entry.toMap())
        column.addView(wrapper)

        entry.getField<List<Map<String, Any>>>("nested")
            .orEmpty()
            .map(CTEntry::from)
            .filter { it.id != null }
            .forEach { nestedEntry ->
                column.addView(create(context, nestedEntry))
            }

        return column
    }
}

internal fun isNestedContent(entry: CTEntry): Boolean = entry.contentTypeId == "nestedContent"
