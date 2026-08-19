import Contentful

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

    /// Creates a configuration that reads definitions through an existing
    /// `contentful.swift` client.
    ///
    /// Prefer this when the app already reads Contentful through the official
    /// Swift SDK: the panel shares that client's configuration, credentials, and
    /// session rather than opening a second connection of its own.
    ///
    /// ```swift
    /// let contentful = Contentful.Client(spaceId: "your-space-id", accessToken: "your-cda-token")
    ///
    /// PreviewPanelConfig(contentfulClient: contentful)
    /// ```
    public init(enabled: Bool = true, contentfulClient: Contentful.Client) {
        self.init(
            enabled: enabled,
            contentfulClient: ContentfulSDKPreviewClient(client: contentfulClient)
        )
    }
}
