/// Declarative configuration for the optimization preview panel.
///
/// Pass an instance to ``OptimizationRoot`` to add the debug preview panel without
/// manually wrapping content in ``PreviewPanelOverlay``. When ``enabled`` is `true`,
/// a floating action button appears that opens the preview panel sheet.
///
/// ```swift
/// OptimizationRoot(
///     config: OptimizationConfig(clientId: "my-id"),
///     previewPanel: PreviewPanelConfig(contentfulClient: myContentfulClient)
/// ) {
///     ContentView()
/// }
/// ```
public struct PreviewPanelConfig {
    /// Whether the preview panel is shown.
    ///
    /// When `true`, a floating action button appears that opens the preview panel sheet.
    public let enabled: Bool

    /// Contentful client used to fetch `nt_audience` and `nt_experience` entries.
    ///
    /// When provided, the panel displays rich audience and experience definitions
    /// (names, types, variant distributions). When `nil`, the panel falls back to
    /// basic data from the SDK.
    public let contentfulClient: PreviewContentfulClient?

    public init(enabled: Bool = true, contentfulClient: PreviewContentfulClient? = nil) {
        self.enabled = enabled
        self.contentfulClient = contentfulClient
    }
}
