package com.contentful.optimization.preview

/**
 * Declarative configuration for the optimization preview panel.
 *
 * Pass an instance to [com.contentful.optimization.compose.OptimizationRoot] to add the debug
 * preview panel without manually wrapping content in [PreviewPanelOverlay]. When [enabled] is
 * `true`, a floating action button appears that opens the preview panel sheet.
 *
 * @property enabled Whether the preview panel is shown.
 * @property contentfulClient Contentful client used to fetch `nt_audience` and `nt_experience`
 *   entries. When provided, the panel displays rich audience and experience definitions; when
 *   `null`, the panel falls back to basic data from the SDK.
 */
public data class PreviewPanelConfig(
    val enabled: Boolean = true,
    val contentfulClient: PreviewContentfulClient? = null,
)
