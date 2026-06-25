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
                    api: OptimizationApiConfig(
                        experienceBaseUrl: AppConfig.experienceBaseUrl,
                        insightsBaseUrl: AppConfig.insightsBaseUrl
                    ),
                    locale: AppConfig.defaultContentfulLocale,
                    defaults: StorageDefaults(consent: true),
                    logLevel: .debug
                ),
                previewPanel: PreviewPanelConfig(
                    contentfulClient: MockPreviewContentfulClient()
                )
            ) {
                MainScreen()
            }
        }
    }
}
