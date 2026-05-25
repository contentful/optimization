package com.contentful.optimization.app.views.components

import android.content.Context
import android.util.TypedValue
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.contentful.optimization.app.views.support.setTestTag
import com.contentful.optimization.shared.RichText
import com.contentful.optimization.views.OptimizationManager
import com.contentful.optimization.views.OptimizedEntryView
import kotlinx.coroutines.launch

/**
 * Builds an [OptimizedEntryView] wrapping a single entry, mirroring `ContentEntryView` from the
 * Compose reference impl: outer wrapper carries `content-entry-$entryId` as its accessibility
 * identifier, inner column carries `entry-text-$entryId` as a test tag and a content description
 * combining the resolved text with `[Entry: $entryId]` so the existing UI Automator helpers
 * (which match `By.descContains("[Entry: $entryId]")`) work unchanged.
 */
object ContentEntryViewBinder {

    fun create(context: Context, entry: Map<String, Any>): View {
        val entryId = entryId(entry)

        val view = OptimizedEntryView(context).apply {
            accessibilityIdentifier = "content-entry-$entryId"
            trackTaps = true
        }
        view.setContentRenderer { resolvedEntry ->
            renderEntryColumn(context, resolvedEntry, entryId)
        }
        view.setEntry(entry)
        return view
    }

    internal fun renderEntryColumn(
        context: Context,
        resolvedEntry: Map<String, Any>,
        entryId: String,
    ): View {
        @Suppress("UNCHECKED_CAST")
        val fields = resolvedEntry["fields"] as? Map<String, Any>
        val padding = context.dp(16)

        val textView = TextView(context).apply { text = "No content" }
        val idLabel = TextView(context).apply { text = "[Entry: $entryId]" }

        val column = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            addView(textView)
            addView(idLabel)
            setTestTag("entry-text-$entryId")
            contentDescription = "No content [Entry: $entryId]"
        }

        // Resolve rich text after the view is attached so we can hook into its lifecycle. The
        // suspending RichText.resolveText needs the client to be initialized; if the view is
        // detached before the resolution finishes we drop the result silently.
        column.addOnAttachStateChangeListener(
            object : View.OnAttachStateChangeListener {
                override fun onViewAttachedToWindow(v: View) {
                    val owner = v.findViewTreeLifecycleOwner() ?: return
                    owner.lifecycleScope.launch {
                        val resolved = RichText.resolveText(
                            fields?.get("text"),
                            OptimizationManager.client,
                        )
                        textView.text = resolved
                        column.contentDescription = "$resolved [Entry: $entryId]"
                    }
                }

                override fun onViewDetachedFromWindow(v: View) {
                }
            },
        )

        return column
    }
}

internal fun Context.dp(value: Int): Int =
    TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value.toFloat(),
        resources.displayMetrics,
    ).toInt()

@Suppress("UNCHECKED_CAST")
internal fun entryId(entry: Map<String, Any>): String {
    val sys = entry["sys"] as? Map<String, Any>
    return sys?.get("id") as? String ?: ""
}
