package com.contentful.optimization.views

import android.content.Context
import android.util.AttributeSet
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView

/**
 * View-based counterpart of [com.contentful.optimization.compose.OptimizationLazyColumn].
 *
 * A drop-in [RecyclerView] that nudges descendant [OptimizedEntryView] instances to re-evaluate
 * their visibility on every scroll frame. Optional: [OptimizedEntryView] inside any scroll
 * container will also re-check via its own
 * [android.view.ViewTreeObserver.OnPreDrawListener], so this class is a redundant signal path
 * for scroll containers whose layout passes do not naturally redraw children.
 */
class TrackingRecyclerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : RecyclerView(context, attrs, defStyleAttr) {

    init {
        addOnScrollListener(
            object : OnScrollListener() {
                override fun onScrolled(rv: RecyclerView, dx: Int, dy: Int) {
                    forEachOptimizedEntry(this@TrackingRecyclerView) {
                        it.requestVisibilityCheck()
                    }
                }
            },
        )
    }

    private fun forEachOptimizedEntry(root: View, action: (OptimizedEntryView) -> Unit) {
        if (root is OptimizedEntryView) action(root)
        if (root is ViewGroup) {
            for (i in 0 until root.childCount) {
                forEachOptimizedEntry(root.getChildAt(i), action)
            }
        }
    }
}
