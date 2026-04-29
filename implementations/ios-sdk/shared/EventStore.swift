import Combine
import Foundation

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
