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

    /**
     * @param resolvedBaselineText Pre-resolved rich text for the BASE entry, computed on the
     * caller's suspending path. When supplied and the SDK's content renderer is invoked with the
     * original (non-personalized) resolved entry, this text is used as the initial TextView value
     * so the column's measured height is stable from the first layout pass — mirroring iOS's
     * synchronous `RichText.resolveText`. When `null` (or when a personalized variant with a
     * different sys.id is handed in), [renderEntryColumn] falls back to the previous async
     * `onViewAttachedToWindow` resolution path.
     */
    fun create(
        context: Context,
        entry: Map<String, Any>,
        resolvedBaselineText: String? = null,
    ): View {
        val entryId = entryId(entry)

        val view = OptimizedEntryView(context).apply {
            accessibilityIdentifier = "content-entry-$entryId"
            trackTaps = true
        }
        view.setContentRenderer { resolvedEntry ->
            val text = if (resolvedBaselineText != null && entryId(resolvedEntry) == entryId) {
                resolvedBaselineText
            } else {
                null
            }
            renderEntryColumn(context, resolvedEntry, entryId, text)
        }
        view.setEntry(entry)
        return view
    }

    internal fun renderEntryColumn(
        context: Context,
        resolvedEntry: Map<String, Any>,
        entryId: String,
        preResolvedText: String? = null,
    ): View {
        @Suppress("UNCHECKED_CAST")
        val fields = resolvedEntry["fields"] as? Map<String, Any>
        // 16dp matches the Compose ContentEntryView's `.padding(16.dp)` — but the Compose Column
        // uses Material3 typography with tighter line height than the default platform TextView,
        // which makes the analytics block sit just below the viewport on identical content. Trim
        // a few dp off horizontally and use a tighter line spacing so the entry list fits in the
        // same vertical budget as the Compose impl.
        val padding = context.dp(12)

        val initialText = preResolvedText ?: "No content"
        val textView = TextView(context).apply {
            text = initialText
            setLineSpacing(0f, 1.0f)
        }
        val idLabel = TextView(context).apply {
            text = "[Entry: $entryId]"
            setLineSpacing(0f, 1.0f)
        }

        val column = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            addView(textView)
            addView(idLabel)
            setTestTag("entry-text-$entryId")
            contentDescription = "$initialText [Entry: $entryId]"
        }

        // Only fall back to async resolution when the caller did NOT pre-resolve the text. With
        // pre-resolved text the TextView is rendered at its final size from the first layout
        // pass, so OptimizedEntryView's `ViewTrackingController` sees a stable height and its 2s
        // dwell cycle is not reset by a layout-driven visibility transition.
        if (preResolvedText == null) {
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
        }

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
