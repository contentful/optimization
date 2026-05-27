package com.contentful.optimization.storage

import android.content.Context
import android.content.SharedPreferences
import com.contentful.optimization.bridge.QuickJsContextManager
import org.json.JSONArray
import org.json.JSONObject

class SharedPreferencesStore(context: Context) : PersistentStore {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("com.contentful.optimization", Context.MODE_PRIVATE)
    private val keyPrefix = "com.contentful.optimization."
    private val cache = mutableMapOf<String, Any?>()

    override fun load() {
        val keys = listOf("profile", "consent", "changes", "personalizations", "anonymousId", "debug")
        for (key in keys) {
            val fullKey = keyPrefix + key
            val stored = prefs.getString(fullKey, null) ?: continue
            when (key) {
                "consent" -> cache[key] = stored
                "anonymousId" -> cache[key] = stored
                "debug" -> cache[key] = stored == "true"
                else -> {
                    try {
                        cache[key] = parseJSON(stored)
                    } catch (_: Exception) {
                        // skip unparseable stored values
                    }
                }
            }
        }
    }

    override fun clear() {
        val keys = listOf("profile", "consent", "changes", "personalizations", "anonymousId", "debug")
        val editor = prefs.edit()
        for (key in keys) {
            editor.remove(keyPrefix + key)
        }
        editor.apply()
        cache.clear()
    }

    override var profile: Map<String, Any>?
        get() {
            @Suppress("UNCHECKED_CAST")
            return cache["profile"] as? Map<String, Any>
        }
        set(value) {
            cache["profile"] = value
            writeJSON(value, "profile")
        }

    override var consent: Boolean?
        get() {
            return when (cache["consent"] as? String) {
                "accepted" -> true
                "denied" -> false
                else -> null
            }
        }
        set(value) {
            val translated = value?.let { if (it) "accepted" else "denied" }
            cache["consent"] = translated
            writeString(translated, "consent")
        }

    override var changes: List<Map<String, Any>>?
        get() {
            @Suppress("UNCHECKED_CAST")
            return cache["changes"] as? List<Map<String, Any>>
        }
        set(value) {
            cache["changes"] = value
            writeJSON(value, "changes")
        }

    override var personalizations: List<Map<String, Any>>?
        get() {
            @Suppress("UNCHECKED_CAST")
            return cache["personalizations"] as? List<Map<String, Any>>
        }
        set(value) {
            cache["personalizations"] = value
            writeJSON(value, "personalizations")
        }

    override var anonymousId: String?
        get() = cache["anonymousId"] as? String
        set(value) {
            cache["anonymousId"] = value
            writeString(value, "anonymousId")
        }

    override var debug: Boolean
        get() = cache["debug"] as? Boolean ?: false
        set(value) {
            cache["debug"] = value
            writeString(if (value) "true" else "false", "debug")
        }

    private fun writeJSON(value: Any?, key: String) {
        val fullKey = keyPrefix + key
        if (value != null) {
            val json = when (value) {
                is Map<*, *> -> JSONObject(value as Map<String, Any>).toString()
                is List<*> -> JSONArray(value).toString()
                else -> value.toString()
            }
            prefs.edit().putString(fullKey, json).apply()
        } else {
            prefs.edit().remove(fullKey).apply()
        }
    }

    private fun writeString(value: String?, key: String) {
        val fullKey = keyPrefix + key
        if (value != null) {
            prefs.edit().putString(fullKey, value).apply()
        } else {
            prefs.edit().remove(fullKey).apply()
        }
    }

    private fun parseJSON(json: String): Any {
        return if (json.trimStart().startsWith("[")) {
            val arr = JSONArray(json)
            (0 until arr.length()).map { QuickJsContextManager.jsonObjectToMap(arr.getJSONObject(it)) }
        } else {
            QuickJsContextManager.jsonObjectToMap(JSONObject(json))
        }
    }
}
