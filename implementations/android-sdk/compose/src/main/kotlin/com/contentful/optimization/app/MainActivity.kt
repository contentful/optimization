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
import com.contentful.optimization.core.OptimizationApiConfig
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.core.OptimizationLogLevel
import com.contentful.optimization.core.StorageDefaults
import com.contentful.optimization.preview.PreviewPanelConfig
import com.contentful.optimization.shared.AppConfig
import com.contentful.optimization.shared.MockPreviewContentfulClient

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
                        api = OptimizationApiConfig(
                            experienceBaseUrl = AppConfig.experienceBaseUrl,
                            insightsBaseUrl = AppConfig.insightsBaseUrl,
                        ),
                        locale = AppConfig.defaultContentfulLocale,
                        defaults = StorageDefaults(consent = true),
                        logLevel = OptimizationLogLevel.debug,
                    ),
                    trackViews = true,
                    trackTaps = true,
                    previewPanel = PreviewPanelConfig(
                        contentfulClient = MockPreviewContentfulClient(),
                    ),
                ) {
                    MainScreen()
                }
            }
        }
    }
}
