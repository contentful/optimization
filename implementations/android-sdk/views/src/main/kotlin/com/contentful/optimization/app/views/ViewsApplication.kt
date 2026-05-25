package com.contentful.optimization.app.views

import android.app.Application
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.preview.PreviewPanelConfig
import com.contentful.optimization.shared.AppConfig
import com.contentful.optimization.shared.MockPreviewContentfulClient
import com.contentful.optimization.views.OptimizationManager

/**
 * View-based equivalent of `OptimizationRoot` in the Compose reference impl. Boots the SDK once
 * per process from [onCreate]; activities read [com.contentful.optimization.views.OptimizationManager.client]
 * to get the live [com.contentful.optimization.core.OptimizationClient].
 */
class ViewsApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        OptimizationManager.initialize(
            context = this,
            config = OptimizationConfig(
                clientId = AppConfig.clientId,
                environment = AppConfig.environment,
                experienceBaseUrl = AppConfig.experienceBaseUrl,
                insightsBaseUrl = AppConfig.insightsBaseUrl,
                debug = true,
            ),
            trackViews = true,
            trackTaps = true,
            previewPanel = PreviewPanelConfig(
                contentfulClient = MockPreviewContentfulClient(),
            ),
        )
    }
}
