import ContentfulOptimization
import SwiftUI

@main
struct OptimizationDemoApp: App {
    init() {
        // UI tests launch with `--reset` to guarantee an unidentified-visitor
        // starting state. The SDK persists `anonymousId`/profile in its own
        // UserDefaults suite, and those outlive `terminate()` + `launch()` on
        // the simulator — so an explicit wipe is the only reliable reset.
        if ProcessInfo.processInfo.arguments.contains("--reset") {
            UserDefaults.standard.removePersistentDomain(forName: "com.contentful.optimization")
        }
    }

    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: OptimizationConfig(
                    clientId: AppConfig.clientId,
                    environment: AppConfig.environment,
                    experienceBaseUrl: AppConfig.experienceBaseUrl,
                    insightsBaseUrl: AppConfig.insightsBaseUrl,
                    debug: true
                ),
                trackViews: true,
                trackTaps: true
            ) {
                PreviewPanelOverlay {
                    MainScreen()
                }
            }
        }
    }
}
