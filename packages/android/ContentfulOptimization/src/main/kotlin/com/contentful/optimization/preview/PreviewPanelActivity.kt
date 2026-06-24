package com.contentful.optimization.preview

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.contentful.optimization.compose.LocalOptimizationClient
import com.contentful.optimization.core.OptimizationClient

/**
 * Compose-only host for the preview panel UI. Retained for backwards compatibility with consumers
 * that historically launched this Activity directly; the SDK no longer routes
 * [addFloatingButton]'s in-activity overlay through it. New callers should rely on the
 * in-activity ComposeView overlay instead, which keeps the FAB and the panel within the
 * embedding activity's accessibility tree — UiAutomator and other accessibility-tree consumers
 * cannot reliably resolve nodes when the panel sits in a separate activity that takes window
 * focus mid-transition.
 */
internal class PreviewPanelActivity : ComponentActivity() {

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

        /**
         * Attach an in-activity preview-panel overlay to [activity]. The FAB and the panel both
         * live in [activity]'s window (the FAB is rendered inside a ComposeView added to the
         * activity's decorView; opening the panel raises a Compose `ModalBottomSheet` in the
         * same window). The previous design launched [PreviewPanelActivity] as a separate
         * activity on FAB tap, but that left UiAutomator unable to resolve panel content while
         * the consuming activity still held focus during the window transition — every shared
         * UI test that opened the panel timed out on `By.text("Preview Panel")` despite the
         * activity displaying correctly.
         *
         * Returns the host [ComposeView] (or `null` if [com.contentful.optimization.views.OptimizationManager.initialize]
         * has not been called yet). The return type stays an Android [android.view.View] for
         * symmetry with the prior `ImageButton` return; callers historically only used it for
         * lifecycle/teardown which is now driven by the host activity automatically.
         */
        fun addFloatingButton(
            activity: Activity,
            client: OptimizationClient,
            contentfulClient: PreviewContentfulClient? = null,
        ): android.view.View {
            sharedClient = client
            sharedContentfulClient = contentfulClient

            val host = ComposeView(activity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                )
                // The ComposeView only renders the FAB and a transient ModalBottomSheet,
                // both of which paint over the underlying view layout. Without this the
                // ComposeView's background swallows everything the consuming activity drew.
                setContent {
                    CompositionLocalProvider(LocalOptimizationClient provides client) {
                        InActivityPreviewPanelOverlay(contentfulClient = contentfulClient)
                    }
                }
            }

            val decorView = activity.window.decorView as? ViewGroup
            decorView?.addView(host)

            return host
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InActivityPreviewPanelOverlay(contentfulClient: PreviewContentfulClient?) {
    val client = LocalOptimizationClient.current
    var isOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(isOpen) {
        client.setPreviewPanelOpen(isOpen)
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Transparent)) {
        FloatingActionButton(
            onClick = { isOpen = true },
            shape = CircleShape,
            containerColor = PreviewTheme.Colors.FAB.background,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(PreviewTheme.Spacing.xxl)
                .size(PreviewTheme.FABSize.diameter)
                .shadow(8.dp, CircleShape)
                .semantics { contentDescription = "preview-panel-fab" },
        ) {
            Icon(
                imageVector = Icons.Default.Settings,
                contentDescription = "Open preview panel",
                tint = PreviewTheme.Colors.FAB.icon,
            )
        }
    }

    if (isOpen) {
        ModalBottomSheet(
            onDismissRequest = { isOpen = false },
            sheetState = sheetState,
            containerColor = PreviewTheme.Colors.Background.secondary,
        ) {
            PreviewPanelContent(contentfulClient = contentfulClient)
        }
    }
}
