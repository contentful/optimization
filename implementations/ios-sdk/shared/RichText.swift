import ContentfulOptimization
import Foundation

/// Flattens a Contentful Rich Text document into a plain display string,
/// resolving any inline merge-tag entries against the current profile.
///
/// Mirrors the React Native demo's `getRichTextContent` so the flattened text
/// (used for accessibility labels) matches byte for byte across SDKs: top-level
/// nodes are joined with a single space, a node's children with the empty string.
@MainActor
enum RichText {

    /// True when `field` is a Rich Text document node rather than a plain string.
    static func isRichTextDocument(_ field: Any?) -> Bool {
        guard let dict = field as? [String: Any] else { return false }
        return dict["nodeType"] as? String == "document" && dict["content"] is [Any]
    }

    /// Resolve an entry's `text` field to a display string: flatten a Rich Text
    /// document (resolving merge tags), pass a plain string through, otherwise
    /// fall back to `"No content"`.
    static func resolveText(_ field: Any?, client: OptimizationClient) -> String {
        if isRichTextDocument(field), let document = field as? [String: Any] {
            return flatten(document, client: client)
        }
        return field as? String ?? "No content"
    }

    /// Flatten a Rich Text document to its display string.
    static func flatten(_ document: [String: Any], client: OptimizationClient) -> String {
        guard let content = document["content"] as? [Any] else { return "" }
        return content
            .compactMap { $0 as? [String: Any] }
            .map { extractText($0, client: client) }
            .joined(separator: " ")
    }

    private static func extractText(_ node: [String: Any], client: OptimizationClient) -> String {
        switch node["nodeType"] as? String {
        case "text":
            return node["value"] as? String ?? ""
        case "embedded-entry-inline":
            return resolveEmbeddedEntry(node, client: client)
        default:
            guard let content = node["content"] as? [Any] else { return "" }
            return content
                .compactMap { $0 as? [String: Any] }
                .map { extractText($0, client: client) }
                .joined()
        }
    }

    private static func resolveEmbeddedEntry(_ node: [String: Any], client: OptimizationClient) -> String {
        guard let data = node["data"] as? [String: Any],
              let target = data["target"] as? [String: Any],
              let sys = target["sys"] as? [String: Any]
        else { return "[Merge Tag]" }

        // A still-unresolved Link means `ContentfulFetcher` did not inline the
        // entry; the flattener has nothing to resolve against.
        if sys["type"] as? String == "Link" { return "[Merge Tag]" }

        let contentTypeId = ((sys["contentType"] as? [String: Any])?["sys"] as? [String: Any])?["id"] as? String
        guard contentTypeId == "nt_mergetag" else { return "[Merge Tag]" }

        if let resolved = client.getMergeTagValue(mergeTagEntry: target), !resolved.isEmpty {
            return resolved
        }
        // Fall back to the merge tag's configured fallback value.
        let fields = target["fields"] as? [String: Any]
        return fields?["nt_fallback"] as? String ?? "[Merge Tag]"
    }
}
