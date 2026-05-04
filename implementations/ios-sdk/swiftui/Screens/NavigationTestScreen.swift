import ContentfulOptimization
import SwiftUI

struct NavigationTestScreen: View {
    let onClose: () -> Void
    @EnvironmentObject private var client: OptimizationClient
    @State private var screenLog: [String] = []
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            VStack {
                Button("Close") { onClose() }
                    .accessibilityIdentifier("close-navigation-test-button")

                Button("Go to View One") { path.append("ViewOne") }
                    .accessibilityIdentifier("go-to-view-one-button")

                Text(screenLog.joined(separator: ","))
                    .accessibilityLabel(screenLog.joined(separator: ","))
                    .accessibilityIdentifier("screen-event-log")
            }
            .trackScreen(name: "NavigationHome")
            .navigationDestination(for: String.self) { destination in
                destinationView(for: destination)
            }
        }
        .onReceive(client.eventPublisher) { event in
            guard let type = event["type"] as? String,
                  type == "screen" || type == "screenViewEvent",
                  let name = event["name"] as? String
            else { return }
            screenLog.append(name)
        }
    }

    @ViewBuilder
    private func destinationView(for destination: String) -> some View {
        switch destination {
        case "ViewOne":
            NavigationViewContent(
                suffix: "one",
                screenLog: screenLog,
                onNavigateNext: { path.append("ViewTwo") },
                nextButtonTitle: "Go to View Two",
                nextButtonTestId: "go-to-view-two-button"
            )
            .trackScreen(name: "NavigationViewOne")
        case "ViewTwo":
            NavigationViewContent(
                suffix: "two",
                screenLog: screenLog,
                onNavigateNext: nil,
                nextButtonTitle: "Go to View Two",
                nextButtonTestId: "go-to-view-two-button"
            )
            .trackScreen(name: "NavigationViewTwo")
        default:
            EmptyView()
        }
    }
}

private struct NavigationViewContent: View {
    let suffix: String
    let screenLog: [String]
    let onNavigateNext: (() -> Void)?
    let nextButtonTitle: String
    let nextButtonTestId: String

    var body: some View {
        VStack {
            Text(screenLog.last ?? "")
                .accessibilityLabel(screenLog.last ?? "")
                .accessibilityIdentifier("last-screen-event")
            Text(screenLog.joined(separator: ","))
                .accessibilityLabel(screenLog.joined(separator: ","))
                .accessibilityIdentifier("screen-event-log")
            if let navigate = onNavigateNext {
                Button(nextButtonTitle) { navigate() }
                    .accessibilityIdentifier(nextButtonTestId)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("navigation-view-test-\(suffix)")
    }
}
