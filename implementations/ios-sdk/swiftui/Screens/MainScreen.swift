import ContentfulOptimization
import SwiftUI

struct MainScreen: View {
    @EnvironmentObject var client: OptimizationClient
    @State private var entries: [[String: Any]] = []
    @State private var isIdentified = false
    @State private var showNavigationTest = false
    @State private var showLiveUpdatesTest = false

    var body: some View {
        if showNavigationTest {
            NavigationTestScreen(onClose: { showNavigationTest = false })
        } else if showLiveUpdatesTest {
            LiveUpdatesTestScreen(onClose: { showLiveUpdatesTest = false })
        } else {
            mainContent
        }
    }

    private var mainContent: some View {
        VStack {
            HStack {
                if !isIdentified {
                    Button("Identify") { handleIdentify() }
                        .accessibilityIdentifier("identify-button")
                } else {
                    Button("Reset") { handleReset() }
                        .accessibilityIdentifier("reset-button")
                }
                Button("Navigation Test") { showNavigationTest = true }
                    .accessibilityIdentifier("navigation-test-button")
                Button("Live Updates Test") { showLiveUpdatesTest = true }
                    .accessibilityIdentifier("live-updates-test-button")
            }
            .padding()

            if entries.isEmpty {
                Text("Loading...")
            } else {
                OptimizationScrollView(accessibilityIdentifier: "main-scroll-view") {
                    VStack {
                        ForEach(0..<entries.count, id: \.self) { index in
                            let entry = entries[index]
                            if isNestedContent(entry) {
                                NestedContentEntryView(entry: entry)
                            } else {
                                ContentEntryView(entry: entry)
                            }
                        }
                        AnalyticsEventDisplay()
                    }
                }
            }
        }
        .task {
            client.consent(true)
            _ = try? await client.page(properties: ["url": "app"])

            // Network simulation for UI tests
            if ProcessInfo.processInfo.arguments.contains("--simulate-offline") {
                client.setOnline(false)
            }
        }
        .onReceive(
            client.$state
                .map(\.profile)
                .removeDuplicates { lhs, rhs in
                    let options: JSONSerialization.WritingOptions = [.sortedKeys]
                    let lhsData = lhs.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
                    let rhsData = rhs.flatMap { try? JSONSerialization.data(withJSONObject: $0, options: options) }
                    return lhsData == rhsData
                }
        ) { profile in
            guard profile != nil else { return }
            Task {
                entries = await ContentfulFetcher.fetchEntries(ids: AppConfig.entryIds)
            }
        }
    }

    private func isNestedContent(_ entry: [String: Any]) -> Bool {
        guard let sys = entry["sys"] as? [String: Any],
              let contentType = sys["contentType"] as? [String: Any],
              let innerSys = contentType["sys"] as? [String: Any],
              let id = innerSys["id"] as? String
        else { return false }
        return id == "nestedContent"
    }

    private func handleIdentify() {
        Task {
            _ = try? await client.identify(userId: "charles", traits: ["identified": true])
        }
        isIdentified = true
    }

    private func handleReset() {
        client.reset()
        Task {
            _ = try? await client.page(properties: ["url": "app"])
        }
        isIdentified = false
    }
}
