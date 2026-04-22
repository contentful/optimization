import Combine
import ContentfulOptimization
import SwiftUI

// MARK: - Persisted Event Store (module-level, survives view lifecycle)

@MainActor
final class EventStore: ObservableObject {
    static let shared = EventStore()

    struct AnalyticsEvent {
        let type: String
        let componentId: String?
        let viewDurationMs: Int?
        let viewId: String?
        let timestamp: Date
    }

    struct ComponentStats {
        var count: Int
        var latestViewDurationMs: Int?
        var latestViewId: String?
    }

    @Published private(set) var events: [AnalyticsEvent] = []
    @Published private(set) var componentStats: [String: ComponentStats] = [:]

    private var cancellable: AnyCancellable?

    private init() {}

    func subscribe(to publisher: AnyPublisher<[String: Any], Never>) {
        cancellable?.cancel()
        cancellable = publisher.sink { [weak self] dict in
            self?.processEvent(dict)
        }
    }

    private func processEvent(_ dict: [String: Any]) {
        guard let type = dict["type"] as? String else { return }

        let event = AnalyticsEvent(
            type: type,
            componentId: dict["componentId"] as? String,
            viewDurationMs: dict["viewDurationMs"] as? Int,
            viewId: dict["viewId"] as? String,
            timestamp: Date()
        )

        events.insert(event, at: 0)

        if type == "component", let cid = event.componentId {
            var stats = componentStats[cid] ?? ComponentStats(count: 0)
            stats.count += 1
            if let ms = event.viewDurationMs { stats.latestViewDurationMs = ms }
            if let vid = event.viewId { stats.latestViewId = vid }
            componentStats[cid] = stats
        }
    }
}

// MARK: - Analytics Event Display View

struct AnalyticsEventDisplay: View {
    @EnvironmentObject private var client: OptimizationClient
    @ObservedObject private var store = EventStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Analytics Events").font(.headline)
            Text("Events: \(store.events.count)")
                .accessibilityLabel("Events: \(store.events.count)")
                .accessibilityIdentifier("events-count")

            if store.events.isEmpty {
                Text("No events tracked yet")
                    .accessibilityLabel("No events tracked yet")
                    .accessibilityIdentifier("no-events-message")
            } else {
                nonComponentEvents
                componentStatsSection
            }
        }
        .padding()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("analytics-events-container")
        .onAppear {
            store.subscribe(to: client.eventPublisher)
        }
    }

    private var nonComponentEvents: some View {
        ForEach(Array(filteredEvents.enumerated()), id: \.offset) { index, event in
            let testId = event.componentId.map { "event-\(event.type)-\($0)" }
                ?? "event-\(event.type)-\(index)"
            let desc = eventDescription(event)
            Text(desc)
                .accessibilityLabel(desc)
                .accessibilityIdentifier(testId)
        }
    }

    private var componentStatsSection: some View {
        ForEach(Array(store.componentStats.keys.sorted()), id: \.self) { cid in
            if let stats = store.componentStats[cid] {
                VStack(alignment: .leading) {
                    Text("Count: \(stats.count)")
                        .accessibilityLabel("Count: \(stats.count)")
                        .accessibilityIdentifier("event-count-\(cid)")
                    Text("Duration: \(stats.latestViewDurationMs.map { "\($0)" } ?? "N/A")")
                        .accessibilityLabel("Duration: \(stats.latestViewDurationMs.map { "\($0)" } ?? "N/A")")
                        .accessibilityIdentifier("event-duration-\(cid)")
                    Text("ViewId: \(stats.latestViewId ?? "N/A")")
                        .accessibilityLabel("ViewId: \(stats.latestViewId ?? "N/A")")
                        .accessibilityIdentifier("event-view-id-\(cid)")
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("component-stats-\(cid)")
            }
        }
    }

    private var filteredEvents: [EventStore.AnalyticsEvent] {
        store.events.filter { $0.type != "component" }
    }

    private func eventDescription(_ event: EventStore.AnalyticsEvent) -> String {
        var desc = event.type
        if let cid = event.componentId { desc += " - Component: \(cid)" }
        if let ms = event.viewDurationMs { desc += " - \(ms)ms" }
        return desc
    }
}
