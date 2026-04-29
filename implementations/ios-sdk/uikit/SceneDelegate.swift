import ContentfulOptimization
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?
    let client = OptimizationClient()

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        try? client.initialize(config: OptimizationConfig(
            clientId: AppConfig.clientId,
            environment: AppConfig.environment,
            experienceBaseUrl: AppConfig.experienceBaseUrl,
            insightsBaseUrl: AppConfig.insightsBaseUrl,
            debug: true
        ))

        let main = MainViewController(client: client)
        let nav = UINavigationController(rootViewController: main)
        nav.setNavigationBarHidden(true, animated: false)

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = nav
        self.window = window
        window.makeKeyAndVisible()

        PreviewPanelViewController.addFloatingButton(to: main, client: client, contentfulClient: nil)
    }
}
