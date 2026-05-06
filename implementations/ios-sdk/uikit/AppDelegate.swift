import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // UI tests launch with `--reset` to guarantee an unidentified-visitor
        // starting state. The SDK persists `anonymousId`/profile in its own
        // UserDefaults suite, and those outlive `terminate()` + `launch()` on
        // the simulator — so an explicit wipe is the only reliable reset.
        if ProcessInfo.processInfo.arguments.contains("--reset") {
            UserDefaults.standard.removePersistentDomain(forName: "com.contentful.optimization")
        }
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}
