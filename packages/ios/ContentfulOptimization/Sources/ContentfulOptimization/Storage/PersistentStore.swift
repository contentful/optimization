import Foundation

/// Protocol for persistent storage of SDK state across app launches.
protocol PersistentStore {
    var profile: [String: Any]? { get set }
    var consent: Bool? { get set }
    var changes: [String: Any]? { get set }
    var personalizations: [[String: Any]]? { get set }
    var anonymousId: String? { get set }
    var debug: Bool { get set }

    func load()
    func clear()
}
