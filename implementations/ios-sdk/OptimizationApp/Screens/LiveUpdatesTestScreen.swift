import ContentfulOptimization
import SwiftUI

struct LiveUpdatesTestScreen: View {
    let onClose: () -> Void
    @EnvironmentObject private var client: OptimizationClient
    @State private var entry: [String: Any]?
    @State private var isLoading = true
    @State private var isIdentified = false
    @State private var globalLiveUpdates = false
    @State private var isPreviewPanelSimulated = false

    var body: some View {
        Group {
        if isLoading {
            ProgressView("Loading...")
        } else if let entry = entry {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    controlsSection
                    statusSection
                    previewPanelSection
                    contentSections(entry: entry)
                }
                .padding()
            }
            .environment(\.trackingConfig, TrackingConfig(
                trackViews: true,
                trackTaps: false,
                liveUpdates: globalLiveUpdates
            ))
            .id("\(globalLiveUpdates)-\(isPreviewPanelSimulated)")
        } else {
            VStack {
                Text("No entry found")
                Button("Close") { onClose() }
                    .accessibilityIdentifier("close-live-updates-test-button")
            }
        }
        }
        .task {
            let personalizedId = "2Z2WLOx07InSewC3LUB3eX"
            let entries = await ContentfulFetcher.fetchEntries(ids: [personalizedId])
            entry = entries.first
            isLoading = false
        }
    }

    // MARK: - Sections

    private var controlsSection: some View {
        VStack(alignment: .leading) {
            Text("Live Updates Test Controls").font(.headline)
            HStack {
                Button("Close") { onClose() }
                    .accessibilityIdentifier("close-live-updates-test-button")
                if !isIdentified {
                    Button("Identify") { handleIdentify() }
                        .accessibilityIdentifier("live-updates-identify-button")
                } else {
                    Button("Reset") { handleReset() }
                        .accessibilityIdentifier("live-updates-reset-button")
                }
                Button("Global: \(globalLiveUpdates ? "ON" : "OFF")") {
                    globalLiveUpdates.toggle()
                }
                .accessibilityIdentifier("toggle-global-live-updates-button")
            }
        }
    }

    private var statusSection: some View {
        VStack(alignment: .leading) {
            HStack {
                Text("Identified:")
                Text(isIdentified ? "Yes" : "No")
                    .accessibilityLabel(isIdentified ? "Yes" : "No")
                    .accessibilityIdentifier("identified-status")
            }
            HStack {
                Text("Global Live Updates:")
                Text(globalLiveUpdates ? "ON" : "OFF")
                    .accessibilityLabel(globalLiveUpdates ? "ON" : "OFF")
                    .accessibilityIdentifier("global-live-updates-status")
            }
        }
    }

    private var previewPanelSection: some View {
        VStack(alignment: .leading) {
            Button(isPreviewPanelSimulated ? "Close Preview Panel" : "Simulate Preview Panel") {
                isPreviewPanelSimulated.toggle()
            }
            .accessibilityIdentifier("simulate-preview-panel-button")
            HStack {
                Text("Preview Panel:")
                Text(isPreviewPanelSimulated ? "Open" : "Closed")
                    .accessibilityLabel(isPreviewPanelSimulated ? "Open" : "Closed")
                    .accessibilityIdentifier("preview-panel-status")
            }
        }
    }

    @ViewBuilder
    private func contentSections(entry: [String: Any]) -> some View {
        OptimizationScrollView(accessibilityIdentifier: "live-updates-scroll-view") {
            VStack(spacing: 20) {
                VStack(alignment: .leading) {
                    Text("Default Behavior (inherits global setting)")
                    Text("No liveUpdates prop - inherits from OptimizationRoot (false)")
                        .font(.caption)
                    OptimizedEntry(
                        entry: entry,
                        accessibilityIdentifier: "default-personalization"
                    ) { resolvedEntry in
                        LiveUpdatesEntryDisplay(entry: resolvedEntry, prefix: "default")
                    }
                }

                VStack(alignment: .leading) {
                    Text("Live Updates Enabled (liveUpdates=true)")
                    Text("Always updates when personalization state changes")
                        .font(.caption)
                    OptimizedEntry(
                        entry: entry,
                        liveUpdates: true,
                        accessibilityIdentifier: "live-personalization"
                    ) { resolvedEntry in
                        LiveUpdatesEntryDisplay(entry: resolvedEntry, prefix: "live")
                    }
                }

                VStack(alignment: .leading) {
                    Text("Locked (liveUpdates=false)")
                    Text("Never updates - locks to first variant received")
                        .font(.caption)
                    OptimizedEntry(
                        entry: entry,
                        liveUpdates: false,
                        accessibilityIdentifier: "locked-personalization"
                    ) { resolvedEntry in
                        LiveUpdatesEntryDisplay(entry: resolvedEntry, prefix: "locked")
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func handleIdentify() {
        Task {
            _ = try? await client.identify(userId: "charles", traits: ["identified": true])
        }
        isIdentified = true
    }

    private func handleReset() {
        client.reset()
        Task {
            _ = try? await client.page(properties: ["url": "live-updates-test"])
        }
        isIdentified = false
    }
}

// MARK: - LiveUpdatesEntryDisplay

private struct LiveUpdatesEntryDisplay: View {
    let entry: [String: Any]
    let prefix: String

    private var text: String {
        let fields = entry["fields"] as? [String: Any]
        return fields?["text"] as? String ?? "No content"
    }

    private var entryId: String {
        let sys = entry["sys"] as? [String: Any]
        return sys?["id"] as? String ?? ""
    }

    var body: some View {
        VStack(alignment: .leading) {
            Text(text)
                .accessibilityLabel(text)
                .accessibilityIdentifier("\(prefix)-text")
            Text("Entry: \(entryId)")
                .accessibilityLabel("Entry: \(entryId)")
                .accessibilityIdentifier("\(prefix)-entry-id")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("\(prefix)-container")
    }
}
