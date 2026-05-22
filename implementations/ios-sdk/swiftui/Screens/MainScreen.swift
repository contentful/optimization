import ContentfulOptimization
import SwiftUI

struct MainScreen: View {
    @EnvironmentObject var client: OptimizationClient
    @State private var entries: [[String: Any]] = []
    @State private var showNavigationTest = false
    @State private var showLiveUpdatesTest = false
    @State private var flagSubscribed = false

    /// Derived from the SDK profile so a rehydrated identified profile renders
    /// the reset control after a cold start, and so the control only flips once
    /// `identify` has actually resolved and been persisted.
    private var isIdentified: Bool {
        let traits = client.state.profile?["traits"] as? [String: Any]
        return traits?["identified"] as? Bool == true
    }

    private var networkControlsEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--enable-network-controls")
    }

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

            // Test-only runtime network controls. XCUITest cannot toggle real
            // connectivity, so the offline-behavior suite drives the SDK online
            // state on the live process — keeping the in-memory Experience queue
            // intact across the offline/online transition.
            if networkControlsEnabled {
                HStack {
                    Button("Go Offline") { client.setOnline(false) }
                        .accessibilityIdentifier("simulate-offline-button")
                    Button("Go Online") { client.setOnline(true) }
                        .accessibilityIdentifier("simulate-online-button")
                }
            }

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
            // Subscribe the event store before any event can fire. The flag-view
            // event emits synchronously on `subscribeToFlag`, so a later
            // subscription (e.g. in a child view's onAppear) would miss it —
            // `eventPublisher` is a PassthroughSubject and does not buffer.
            EventStore.shared.subscribe(to: client.eventPublisher)
            client.consent(true)
            _ = try? await client.page(properties: ["url": "app"])
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
            // Subscribe to the `boolean` flag once a profile (and consent) is
            // available so a flag-view `component` event is emitted — mirrors
            // the React Native app's gated `sdk.states.flag(...).subscribe(...)`.
            if !flagSubscribed {
                flagSubscribed = true
                client.subscribeToFlag("boolean")
            }
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
    }

    private func handleReset() {
        client.reset()
        Task {
            _ = try? await client.page(properties: ["url": "app"])
        }
    }
}
