package com.contentful.optimization.app

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Surface
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import com.contentful.optimization.app.screens.MainScreen
import com.contentful.optimization.compose.OptimizationRoot
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.preview.PreviewPanelOverlay

class MainActivity : ComponentActivity() {

    @OptIn(ExperimentalComposeUiApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent.getBooleanExtra("reset", false)) {
            getSharedPreferences("com.contentful.optimization", Context.MODE_PRIVATE)
                .edit()
                .clear()
                .apply()
        }

        val simulateOffline = intent.getBooleanExtra("simulate_offline", false)

        setContent {
            Surface(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.systemBars)
                    .semantics { testTagsAsResourceId = true },
            ) {
                OptimizationRoot(
                    config = OptimizationConfig(
                        clientId = AppConfig.clientId,
                        environment = AppConfig.environment,
                        experienceBaseUrl = AppConfig.experienceBaseUrl,
                        insightsBaseUrl = AppConfig.insightsBaseUrl,
                        debug = true,
                    ),
                    trackViews = true,
                    trackTaps = true,
                ) {
                    PreviewPanelOverlay(contentfulClient = MockPreviewContentfulClient()) {
                        MainScreen(simulateOffline = simulateOffline)
                    }
                }
            }
        }
    }
}
