package com.contentful.optimization.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

object ContentfulFetcher {

    private val httpClient = OkHttpClient()

    suspend fun fetchEntries(ids: List<String>): List<Map<String, Any>> {
        val entries = mutableListOf<Map<String, Any>>()
        for (id in ids) {
            fetchEntry(id)?.let { entries.add(it) }
        }
        return entries
    }

    private suspend fun fetchEntry(id: String): Map<String, Any>? {
        val url = "${AppConfig.contentfulBaseUrl}spaces/${AppConfig.contentfulSpaceId}" +
            "/environments/${AppConfig.environment}/entries?sys.id=$id&include=10"

        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder().url(url).build()
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext null

                val json = JSONObject(body)
                val items = json.optJSONArray("items") ?: return@withContext null
                if (items.length() == 0) return@withContext null

                val entry = jsonObjectToMap(items.getJSONObject(0))
                val includes = json.optJSONObject("includes")?.let { jsonObjectToMap(it) }
                resolveLinks(entry, includes)
            } catch (_: Exception) {
                null
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveLinks(
        entry: Map<String, Any>,
        includes: Map<String, Any>?,
    ): Map<String, Any> {
        val lookup = mutableMapOf<String, Map<String, Any>>()

        val includeEntries = includes?.get("Entry") as? List<Map<String, Any>>
        includeEntries?.forEach { e ->
            val sys = e["sys"] as? Map<String, Any>
            val id = sys?.get("id") as? String
            if (id != null) lookup[id] = e
        }

        val includeAssets = includes?.get("Asset") as? List<Map<String, Any>>
        includeAssets?.forEach { a ->
            val sys = a["sys"] as? Map<String, Any>
            val id = sys?.get("id") as? String
            if (id != null) lookup[id] = a
        }

        return resolveValue(entry, lookup) as? Map<String, Any> ?: entry
    }

    @Suppress("UNCHECKED_CAST")
    private fun resolveValue(value: Any, lookup: Map<String, Map<String, Any>>, depth: Int = 0): Any {
        // Each recursion into an object key, array element, or Link target
        // bumps depth, so reaching a variant entry under
        // `<parent>.fields.nested[*].fields.nt_experiences[*].fields.nt_variants[*]`
        // crosses depth 10. A budget of 32 covers nested optimization trees
        // without risking pathological cycles.
        if (depth >= 32) return value

        if (value is Map<*, *>) {
            val dict = value as Map<String, Any>
            val sys = dict["sys"] as? Map<String, Any>
            if (sys != null) {
                val type = sys["type"] as? String
                val id = sys["id"] as? String
                if (type == "Link" && id != null) {
                    val resolved = lookup[id]
                    if (resolved != null) {
                        return resolveValue(resolved, lookup, depth + 1)
                    }
                }
            }

            val result = mutableMapOf<String, Any>()
            for ((key, v) in dict) {
                result[key] = resolveValue(v, lookup, depth + 1)
            }
            return result
        }

        if (value is List<*>) {
            return value.map { resolveValue(it ?: return@map it, lookup, depth + 1) }
        }

        return value
    }

    private fun jsonObjectToMap(obj: JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        for (key in obj.keys()) {
            map[key] = jsonValueToKotlin(obj.get(key))
        }
        return map
    }

    private fun jsonArrayToList(arr: JSONArray): List<Any> {
        val list = mutableListOf<Any>()
        for (i in 0 until arr.length()) {
            list.add(jsonValueToKotlin(arr.get(i)))
        }
        return list
    }

    private fun jsonValueToKotlin(value: Any): Any {
        return when (value) {
            is JSONObject -> jsonObjectToMap(value)
            is JSONArray -> jsonArrayToList(value)
            JSONObject.NULL -> "null"
            else -> value
        }
    }
}
