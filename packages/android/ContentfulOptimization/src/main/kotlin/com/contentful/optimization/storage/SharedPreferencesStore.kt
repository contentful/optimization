package com.contentful.optimization.storage

import android.content.Context
import android.content.SharedPreferences
import com.contentful.optimization.bridge.QuickJsContextManager
import com.contentful.optimization.core.ConsentStoragePolicy
import com.contentful.optimization.core.DiagnosticLogger
import org.json.JSONArray
import org.json.JSONObject

internal class SharedPreferencesStore(context: Context) : PersistentStore {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("com.contentful.optimization", Context.MODE_PRIVATE)
    private val keyPrefix = "com.contentful.optimization."
    private val cache = mutableMapOf<String, Any?>()
    private val consentStateKeys = listOf("consent", "persistenceConsent")
    private val profileContinuityKeys = listOf("profile", "changes", "selectedOptimizations", "anonymousId")
    private val keys = consentStateKeys + profileContinuityKeys

    override fun loadConsentState() {
        load(consentStateKeys)
    }

    override fun loadProfileContinuity() {
        load(profileContinuityKeys)
    }

    private fun load(keys: List<String>) {
        for (key in keys) {
            val fullKey = keyPrefix + key
            val stored = prefs.getString(fullKey, null) ?: continue
            when (key) {
                "consent", "persistenceConsent" -> cache[key] = stored
                "anonymousId" -> cache[key] = stored
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
        val editor = prefs.edit()
        for (key in keys) {
            editor.remove(keyPrefix + key)
        }
        editor.commitPersistedUpdate("clear")
        cache.clear()
    }

    override fun clearProfileContinuity() {
        val editor = prefs.edit()
        for (key in profileContinuityKeys) {
            editor.remove(keyPrefix + key)
            cache.remove(key)
        }
        editor.commitPersistedUpdate("clear profile continuity")
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
            return ConsentStoragePolicy.decode(cache["consent"] as? String)
        }
        set(value) {
            val translated = ConsentStoragePolicy.encode(value)
            cache["consent"] = translated
            writeString(translated, "consent")
        }

    override var persistenceConsent: Boolean?
        get() {
            return ConsentStoragePolicy.resolvePersistedPersistenceConsent(
                ConsentStoragePolicy.decode(cache["persistenceConsent"] as? String),
                consent,
            )
        }
        set(value) {
            val translated = ConsentStoragePolicy.encode(value)
            cache["persistenceConsent"] = translated
            writeString(translated, "persistenceConsent")
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

    override var selectedOptimizations: List<Map<String, Any>>?
        get() {
            @Suppress("UNCHECKED_CAST")
            return cache["selectedOptimizations"] as? List<Map<String, Any>>
        }
        set(value) {
            cache["selectedOptimizations"] = value
            writeJSON(value, "selectedOptimizations")
        }

    override var anonymousId: String?
        get() = cache["anonymousId"] as? String
        set(value) {
            cache["anonymousId"] = value
            writeString(value, "anonymousId")
        }

    private fun writeJSON(value: Any?, key: String) {
        val fullKey = keyPrefix + key
        if (value != null) {
            val json = when (value) {
                is Map<*, *> -> JSONObject(value as Map<String, Any>).toString()
                is List<*> -> JSONArray(value).toString()
                else -> value.toString()
            }
            prefs.edit().putString(fullKey, json).commitPersistedUpdate("write $key")
        } else {
            prefs.edit().remove(fullKey).commitPersistedUpdate("remove $key")
        }
    }

    private fun writeString(value: String?, key: String) {
        val fullKey = keyPrefix + key
        if (value != null) {
            prefs.edit().putString(fullKey, value).commitPersistedUpdate("write $key")
        } else {
            prefs.edit().remove(fullKey).commitPersistedUpdate("remove $key")
        }
    }

    private fun SharedPreferences.Editor.commitPersistedUpdate(operation: String) {
        if (!commit()) {
            DiagnosticLogger.warning { "[storage] SharedPreferences commit failed during $operation" }
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
