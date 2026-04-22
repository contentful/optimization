#if canImport(UIKit)
import SwiftUI
import UIKit

/// A UIKit view controller that presents the optimization preview/debug panel.
///
/// Use this in UIKit apps to inspect and override audiences, variants, and profile state.
///
/// ```swift
/// let contentfulClient = ContentfulHTTPPreviewClient(
///     spaceId: "your-space-id",
///     accessToken: "your-cda-token"
/// )
/// let previewVC = PreviewPanelViewController(client: client, contentfulClient: contentfulClient)
/// present(previewVC, animated: true)
/// ```
///
/// Or add the floating action button to any view controller:
/// ```swift
/// PreviewPanelViewController.addFloatingButton(to: self, client: client, contentfulClient: contentfulClient)
/// ```
///
/// The `contentfulClient` parameter is optional. When provided, the panel displays
/// rich audience and experience definitions fetched from Contentful.
@MainActor
public final class PreviewPanelViewController: UIHostingController<AnyView> {

    private let client: OptimizationClient

    public init(client: OptimizationClient, contentfulClient: PreviewContentfulClient? = nil) {
        self.client = client
        let view = PreviewPanelContent(contentfulClient: contentfulClient).environmentObject(client)
        super.init(rootView: AnyView(view))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if isBeingDismissed {
            client.setPreviewPanelOpen(false)
        }
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        client.setPreviewPanelOpen(true)
    }

    /// Adds a floating debug button to a UIKit view controller that presents the preview panel on tap.
    ///
    /// - Parameters:
    ///   - viewController: The view controller to add the button to.
    ///   - client: The optimization client instance.
    ///   - contentfulClient: Optional Contentful client for rich definitions.
    /// - Returns: The created button, in case you need to manage its lifecycle.
    @discardableResult
    public static func addFloatingButton(
        to viewController: UIViewController,
        client: OptimizationClient,
        contentfulClient: PreviewContentfulClient? = nil
    ) -> UIButton {
        let button = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        button.setImage(UIImage(systemName: "slider.horizontal.3", withConfiguration: config), for: .normal)
        button.tintColor = UIColor(pt_hex: 0x8C2EEA)
        button.backgroundColor = UIColor(pt_hex: 0xEADDFF)
        button.layer.cornerRadius = 28
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOpacity = 0.15
        button.layer.shadowOffset = CGSize(width: 0, height: 4)
        button.layer.shadowRadius = 8
        button.accessibilityIdentifier = "preview-panel-fab"
        button.translatesAutoresizingMaskIntoConstraints = false

        viewController.view.addSubview(button)
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 56),
            button.heightAnchor.constraint(equalToConstant: 56),
            button.trailingAnchor.constraint(equalTo: viewController.view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            button.bottomAnchor.constraint(equalTo: viewController.view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
        ])

        button.addAction(UIAction { [weak viewController] _ in
            guard let viewController else { return }
            let previewVC = PreviewPanelViewController(client: client, contentfulClient: contentfulClient)
            viewController.present(previewVC, animated: true)
        }, for: .touchUpInside)

        return button
    }
}
#endif
