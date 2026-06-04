import Foundation

/// Persistent storage adapter backed by `UserDefaults`.
///
/// Provides in-memory caching with write-through to UserDefaults for SDK state
/// such as profile, changes, consent, and personalizations.
final class UserDefaultsStore: PersistentStore {
    private let defaults: UserDefaults
    private let keyPrefix = "com.contentful.optimization."

    private var cache: [String: Any] = [:]
    private let consentStateKeys = ["consent", "persistenceConsent", "debug"]
    private let profileContinuityKeys = ["profile", "changes", "personalizations", "anonymousId"]
    private var keys: [String] { consentStateKeys + profileContinuityKeys }

    init(suiteName: String = "com.contentful.optimization") {
        self.defaults = UserDefaults(suiteName: suiteName) ?? .standard
    }

    func loadConsentState() {
        load(keys: consentStateKeys)
    }

    func loadProfileContinuity() {
        load(keys: profileContinuityKeys)
    }

    private func load(keys: [String]) {
        for key in keys {
            let fullKey = keyPrefix + key
            guard let data = defaults.data(forKey: fullKey) else { continue }

            switch key {
            case "consent", "persistenceConsent":
                if let str = String(data: data, encoding: .utf8) {
                    cache[key] = str
                }
            case "anonymousId":
                if let str = String(data: data, encoding: .utf8) {
                    cache[key] = str
                }
            case "debug":
                if let str = String(data: data, encoding: .utf8) {
                    cache[key] = str == "true"
                }
            default:
                if let json = try? JSONSerialization.jsonObject(with: data) {
                    cache[key] = json
                }
            }
        }
    }

    func clear() {
        for key in keys {
            defaults.removeObject(forKey: keyPrefix + key)
        }
        cache.removeAll()
    }

    func clearProfileContinuity() {
        for key in profileContinuityKeys {
            defaults.removeObject(forKey: keyPrefix + key)
            cache.removeValue(forKey: key)
        }
    }

    // MARK: - Properties

    var profile: [String: Any]? {
        get { cache["profile"] as? [String: Any] }
        set {
            cache["profile"] = newValue
            writeJSON(newValue, forKey: "profile")
        }
    }

    var consent: Bool? {
        get {
            guard let str = cache["consent"] as? String else { return nil }
            switch str {
            case "accepted": return true
            case "denied": return false
            default: return nil
            }
        }
        set {
            let translated: String? = newValue.map { $0 ? "accepted" : "denied" }
            cache["consent"] = translated
            writeString(translated, forKey: "consent")
        }
    }

    var persistenceConsent: Bool? {
        get {
            guard let str = cache["persistenceConsent"] as? String else {
                return consent == true ? true : nil
            }
            switch str {
            case "accepted": return true
            case "denied": return false
            default: return nil
            }
        }
        set {
            let translated: String? = newValue.map { $0 ? "accepted" : "denied" }
            cache["persistenceConsent"] = translated
            writeString(translated, forKey: "persistenceConsent")
        }
    }

    var changes: [[String: Any]]? {
        get { cache["changes"] as? [[String: Any]] }
        set {
            cache["changes"] = newValue
            writeJSON(newValue, forKey: "changes")
        }
    }

    var personalizations: [[String: Any]]? {
        get { cache["personalizations"] as? [[String: Any]] }
        set {
            cache["personalizations"] = newValue
            writeJSON(newValue, forKey: "personalizations")
        }
    }

    var anonymousId: String? {
        get { cache["anonymousId"] as? String }
        set {
            cache["anonymousId"] = newValue
            writeString(newValue, forKey: "anonymousId")
        }
    }

    var debug: Bool {
        get { cache["debug"] as? Bool ?? false }
        set {
            cache["debug"] = newValue
            writeString(newValue ? "true" : "false", forKey: "debug")
        }
    }

    // MARK: - Private

    private func writeJSON(_ value: Any?, forKey key: String) {
        let fullKey = keyPrefix + key
        if let value = value,
           let data = try? JSONSerialization.data(withJSONObject: value) {
            defaults.set(data, forKey: fullKey)
        } else {
            defaults.removeObject(forKey: fullKey)
        }
    }

    private func writeString(_ value: String?, forKey key: String) {
        let fullKey = keyPrefix + key
        if let value = value {
            defaults.set(value.data(using: .utf8), forKey: fullKey)
        } else {
            defaults.removeObject(forKey: fullKey)
        }
    }
}
