package com.contentful.optimization.preview

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageButton
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.core.OptimizationClient

class PreviewPanelActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val client = sharedClient ?: run { finish(); return }
        val contentfulClient = sharedContentfulClient

        setContent {
            CompositionLocalProvider(LocalOptimizationClient provides client) {
                PreviewPanelContent(contentfulClient = contentfulClient)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        sharedClient?.setPreviewPanelOpen(true)
    }

    override fun onPause() {
        super.onPause()
        if (isFinishing) {
            sharedClient?.setPreviewPanelOpen(false)
        }
    }

    companion object {
        private var sharedClient: OptimizationClient? = null
        private var sharedContentfulClient: PreviewContentfulClient? = null

        fun addFloatingButton(
            activity: Activity,
            client: OptimizationClient,
            contentfulClient: PreviewContentfulClient? = null,
        ): ImageButton {
            sharedClient = client
            sharedContentfulClient = contentfulClient

            val button = ImageButton(activity).apply {
                setBackgroundColor(0xFFEADDFF.toInt())
                contentDescription = "preview-panel-fab"
                setPadding(16, 16, 16, 16)
                elevation = 8f

                val params = FrameLayout.LayoutParams(
                    dpToPx(activity, 56),
                    dpToPx(activity, 56),
                ).apply {
                    gravity = Gravity.BOTTOM or Gravity.END
                    marginEnd = dpToPx(activity, 24)
                    bottomMargin = dpToPx(activity, 24)
                }
                layoutParams = params

                setOnClickListener {
                    val intent = android.content.Intent(activity, PreviewPanelActivity::class.java)
                    activity.startActivity(intent)
                }
            }

            val decorView = activity.window.decorView as? ViewGroup
            decorView?.addView(button)

            return button
        }

        private fun dpToPx(activity: Activity, dp: Int): Int {
            return (dp * activity.resources.displayMetrics.density).toInt()
        }
    }
}
