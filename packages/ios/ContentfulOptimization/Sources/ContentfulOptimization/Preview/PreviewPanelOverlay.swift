import SwiftUI

/// A floating action button overlay that opens the preview panel sheet.
///
/// Wrap your app content in this view to add a debug preview panel:
/// ```swift
/// PreviewPanelOverlay {
///     YourAppContent()
/// }
/// ```
public struct PreviewPanelOverlay<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @State private var isOpen = false
    @EnvironmentObject private var client: OptimizationClient

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content()

            Button(action: { isOpen.toggle() }) {
                Image(systemName: "gear")
                    .font(.title2)
                    .padding()
                    .background(Circle().fill(Color.blue))
                    .foregroundColor(.white)
                    .shadow(radius: 4)
            }
            .padding()
            .accessibilityIdentifier("preview-panel-fab")
            .sheet(isPresented: $isOpen) {
                PreviewPanelContent()
                    .environmentObject(client)
            }
        }
        .onChange(of: isOpen) { newValue in
            client.setPreviewPanelOpen(newValue)
        }
    }
}
