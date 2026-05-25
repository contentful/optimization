package com.contentful.optimization.shared

import com.contentful.optimization.core.OptimizationClient

/**
 * Flattens a Contentful Rich Text document into a plain display string,
 * resolving inline merge-tag entries against the current profile.
 *
 * Mirrors the iOS app's `RichText` so the flattened text matches byte for byte:
 * top-level nodes are joined with a single space, a node's children with the
 * empty string.
 */
@Suppress("UNCHECKED_CAST")
object RichText {

    /** True when [field] is a Rich Text document node rather than a plain string. */
    fun isRichTextDocument(field: Any?): Boolean {
        val dict = field as? Map<*, *> ?: return false
        return dict["nodeType"] == "document" && dict["content"] is List<*>
    }

    /**
     * Resolve an entry's `text` field to a display string: flatten a Rich Text
     * document (resolving merge tags), pass a plain string through, otherwise
     * fall back to `"No content"`.
     */
    suspend fun resolveText(field: Any?, client: OptimizationClient): String {
        if (isRichTextDocument(field)) {
            return flatten(field as Map<String, Any>, client)
        }
        return field as? String ?: "No content"
    }

    private suspend fun flatten(document: Map<String, Any>, client: OptimizationClient): String {
        val content = document["content"] as? List<*> ?: return ""
        val parts = mutableListOf<String>()
        for (node in content.mapNotNull { it as? Map<String, Any> }) {
            parts.add(extractText(node, client))
        }
        return parts.joinToString(" ")
    }

    private suspend fun extractText(node: Map<String, Any>, client: OptimizationClient): String {
        return when (node["nodeType"]) {
            "text" -> node["value"] as? String ?: ""
            "embedded-entry-inline" -> resolveEmbeddedEntry(node, client)
            else -> {
                val content = node["content"] as? List<*> ?: return ""
                val parts = mutableListOf<String>()
                for (child in content.mapNotNull { it as? Map<String, Any> }) {
                    parts.add(extractText(child, client))
                }
                parts.joinToString("")
            }
        }
    }

    private suspend fun resolveEmbeddedEntry(
        node: Map<String, Any>,
        client: OptimizationClient,
    ): String {
        val data = node["data"] as? Map<String, Any> ?: return "[Merge Tag]"
        val target = data["target"] as? Map<String, Any> ?: return "[Merge Tag]"
        val sys = target["sys"] as? Map<String, Any> ?: return "[Merge Tag]"

        // A still-unresolved Link means the fetcher did not inline the entry;
        // there is nothing to resolve against.
        if (sys["type"] == "Link") return "[Merge Tag]"

        val contentTypeSys =
            (sys["contentType"] as? Map<String, Any>)?.get("sys") as? Map<String, Any>
        if (contentTypeSys?.get("id") != "nt_mergetag") return "[Merge Tag]"

        val resolved = client.getMergeTagValue(target)
        if (!resolved.isNullOrEmpty()) return resolved

        // Fall back to the merge tag's configured fallback value.
        val fields = target["fields"] as? Map<String, Any>
        return fields?.get("nt_fallback") as? String ?: "[Merge Tag]"
    }
}
