package com.contentful.optimization.shared

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ContentfulFetcher {

    private const val TAG = "ContentfulFetcher"
    private const val MAX_ATTEMPTS = 3
    private const val RETRY_BACKOFF_MS = 250L

    // OkHttp's defaults (10s) are too aggressive for localhost via `adb reverse` on the
    // x86_64 CI emulator, where the first fetch after activity launch consistently
    // returned null silently — leaving 7 of 8 AppConfig entries unrendered and breaking
    // testTracksEntryViewEventsForVisibleEntries, which asserts on a specific entry's
    // component-stats. Generous timeouts plus a small retry loop keep this fetch path
    // deterministic across both arm64 (local) and x86_64 (CI) host environments.
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(45, TimeUnit.SECONDS)
        .build()

    suspend fun fetchEntries(ids: List<String>): List<Map<String, Any>> {
        val entries = mutableListOf<Map<String, Any>>()
        for (id in ids) {
            val entry = fetchEntry(id)
            if (entry != null) {
                entries.add(entry)
            } else {
                Log.w(TAG, "fetchEntries: dropped entry id=$id (all attempts returned null)")
            }
        }
        Log.i(TAG, "fetchEntries: requested=${ids.size}, returned=${entries.size}")
        return entries
    }

    private suspend fun fetchEntry(id: String): Map<String, Any>? {
        repeat(MAX_ATTEMPTS) { attempt ->
            val result = fetchEntryOnce(id, attempt)
            if (result != null) return result
            if (attempt < MAX_ATTEMPTS - 1) {
                delay(RETRY_BACKOFF_MS * (attempt + 1))
            }
        }
        return null
    }

    private suspend fun fetchEntryOnce(id: String, attempt: Int): Map<String, Any>? {
        val url = "${AppConfig.contentfulBaseUrl}spaces/${AppConfig.contentfulSpaceId}" +
            "/environments/${AppConfig.environment}/entries?sys.id=$id&include=10"

        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder().url(url).build()
                val response = httpClient.newCall(request).execute()
                val code = response.code
                val body = response.body?.string()
                if (body == null) {
                    Log.w(TAG, "fetchEntry[$id] attempt=$attempt: empty body (status=$code)")
                    return@withContext null
                }

                val json = JSONObject(body)
                val items = json.optJSONArray("items")
                if (items == null || items.length() == 0) {
                    Log.w(TAG, "fetchEntry[$id] attempt=$attempt: no items (status=$code, body length=${body.length})")
                    return@withContext null
                }

                val entry = jsonObjectToMap(items.getJSONObject(0))
                val includes = json.optJSONObject("includes")?.let { jsonObjectToMap(it) }
                resolveLinks(entry, includes)
            } catch (e: Exception) {
                Log.w(TAG, "fetchEntry[$id] attempt=$attempt: ${e.javaClass.simpleName}: ${e.message}")
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
