import Foundation

struct ContentfulFetcher {

    static func fetchEntries(ids: [String]) async -> [[String: Any]] {
        var entries: [[String: Any]] = []
        for id in ids {
            if let entry = await fetchEntry(id: id) {
                entries.append(entry)
            }
        }
        return entries
    }

    static func fetchEntry(id: String) async -> [String: Any]? {
        let urlString = "\(AppConfig.contentfulBaseUrl)spaces/\(AppConfig.contentfulSpaceId)/environments/\(AppConfig.environment)/entries?sys.id=\(id)&include=10"
        guard let url = URL(string: urlString) else { return nil }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let items = json["items"] as? [[String: Any]],
                  let entry = items.first
            else { return nil }

            let includes = json["includes"] as? [String: Any]
            return resolveLinks(in: entry, includes: includes)
        } catch {
            return nil
        }
    }

    // MARK: - Link Resolution

    private static func resolveLinks(in entry: [String: Any], includes: [String: Any]?) -> [String: Any] {
        var lookup: [String: [String: Any]] = [:]

        if let includeEntries = includes?["Entry"] as? [[String: Any]] {
            for e in includeEntries {
                if let sys = e["sys"] as? [String: Any], let id = sys["id"] as? String {
                    lookup[id] = e
                }
            }
        }

        if let includeAssets = includes?["Asset"] as? [[String: Any]] {
            for a in includeAssets {
                if let sys = a["sys"] as? [String: Any], let id = sys["id"] as? String {
                    lookup[id] = a
                }
            }
        }

        return resolveValue(entry, lookup: lookup) as? [String: Any] ?? entry
    }

    private static func resolveValue(_ value: Any, lookup: [String: [String: Any]], depth: Int = 0) -> Any {
        guard depth < 10 else { return value }

        if let dict = value as? [String: Any] {
            if let sys = dict["sys"] as? [String: Any],
               let type = sys["type"] as? String,
               type == "Link",
               let id = sys["id"] as? String,
               let resolved = lookup[id] {
                return resolveValue(resolved, lookup: lookup, depth: depth + 1)
            }

            var result: [String: Any] = [:]
            for (key, val) in dict {
                result[key] = resolveValue(val, lookup: lookup, depth: depth + 1)
            }
            return result
        } else if let array = value as? [Any] {
            return array.map { resolveValue($0, lookup: lookup, depth: depth + 1) }
        }

        return value
    }
}
