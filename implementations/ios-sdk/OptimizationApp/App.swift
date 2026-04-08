import ContentfulOptimization
import SwiftUI

@main
struct OptimizationDemoApp: App {
    var body: some Scene {
        WindowGroup {
            OptimizationRoot(
                config: OptimizationConfig(
                    clientId: AppConfig.clientId,
                    environment: AppConfig.environment,
                    experienceBaseUrl: AppConfig.experienceBaseUrl,
                    insightsBaseUrl: AppConfig.insightsBaseUrl
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
