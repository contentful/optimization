import SwiftUI

/// A floating action button overlay that opens the preview panel sheet.
///
/// Wrap your app content in this view to add a debug preview panel:
/// ```swift
/// let contentfulClient = ContentfulHTTPPreviewClient(
///     spaceId: "your-space-id",
///     accessToken: "your-cda-token"
/// )
///
/// PreviewPanelOverlay(contentfulClient: contentfulClient) {
///     YourAppContent()
/// }
/// ```
///
/// The `contentfulClient` parameter is optional. When provided, the panel displays
/// rich audience and experience definitions fetched from Contentful (names, types,
/// variant distributions). Without it, the panel falls back to basic data from the SDK.
public struct PreviewPanelOverlay<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @State private var isOpen = false
    @EnvironmentObject private var client: OptimizationClient

    private let contentfulClient: PreviewContentfulClient?

    public init(contentfulClient: PreviewContentfulClient? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.contentfulClient = contentfulClient
        self.content = content
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content()

            Button(action: { isOpen.toggle() }) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(PreviewTheme.Colors.FAB.icon)
                    .frame(width: PreviewTheme.FABSize.diameter, height: PreviewTheme.FABSize.diameter)
                    .background(
                        Circle()
                            .fill(PreviewTheme.Colors.FAB.background)
                    )
                    .shadow(color: Color.black.opacity(0.15), radius: 8, x: 0, y: 4)
            }
            .padding(.trailing, PreviewTheme.Spacing.xxl)
            .padding(.bottom, PreviewTheme.Spacing.xxl)
            .accessibilityIdentifier("preview-panel-fab")
            .sheet(isPresented: $isOpen) {
                PreviewPanelContent(contentfulClient: contentfulClient)
                    .environmentObject(client)
            }
        }
        .onChange(of: isOpen) { newValue in
            client.setPreviewPanelOpen(newValue)
        }
    }
}
