package com.contentful.optimization.preview

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.contentful.optimization.compose.LocalOptimizationClient

@OptIn(ExperimentalMaterial3Api::class)
@Composable
public fun PreviewPanelOverlay(
    contentfulClient: PreviewContentfulClient? = null,
    content: @Composable () -> Unit,
) {
    val client = LocalOptimizationClient.current
    var isOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(isOpen) {
        client.setPreviewPanelOpen(isOpen)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        content()

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
