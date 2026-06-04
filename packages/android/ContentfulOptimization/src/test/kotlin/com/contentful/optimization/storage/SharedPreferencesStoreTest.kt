package com.contentful.optimization.storage

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SharedPreferencesStoreTest {
    @Test
    fun `clearProfileContinuity preserves consent values`() {
        val context = StoreTestContext()
        val store = SharedPreferencesStore(context)

        store.consent = true
        store.persistenceConsent = false
        store.profile = mapOf("id" to "profile-id")
        store.changes = listOf(mapOf("experienceId" to "experience-id"))
        store.personalizations = listOf(mapOf("experienceId" to "personalization-id"))
        store.anonymousId = "anonymous-id"

        store.clearProfileContinuity()

        assertEquals(true, store.consent)
        assertEquals(false, store.persistenceConsent)
        assertNull(store.profile)
        assertNull(store.changes)
        assertNull(store.personalizations)
        assertNull(store.anonymousId)

        val reloadedStore = SharedPreferencesStore(context)
        reloadedStore.loadConsentState()

        assertEquals(true, reloadedStore.consent)
        assertEquals(false, reloadedStore.persistenceConsent)
        assertNull(reloadedStore.profile)
        assertNull(reloadedStore.changes)
        assertNull(reloadedStore.personalizations)
        assertNull(reloadedStore.anonymousId)
    }

    @Test
    fun `loadConsentState does not load profile continuity`() {
        val context = StoreTestContext()
        val store = SharedPreferencesStore(context)

        store.consent = true
        store.persistenceConsent = true
        store.profile = mapOf("id" to "profile-id")
        store.changes = listOf(mapOf("experienceId" to "experience-id"))
        store.personalizations = listOf(mapOf("experienceId" to "personalization-id"))
        store.anonymousId = "anonymous-id"

        val reloadedStore = SharedPreferencesStore(context)
        reloadedStore.loadConsentState()

        assertEquals(true, reloadedStore.consent)
        assertEquals(true, reloadedStore.persistenceConsent)
        assertNull(reloadedStore.profile)
        assertNull(reloadedStore.changes)
        assertNull(reloadedStore.personalizations)
        assertNull(reloadedStore.anonymousId)

        reloadedStore.loadProfileContinuity()

        assertEquals("profile-id", reloadedStore.profile?.get("id"))
        assertEquals("experience-id", reloadedStore.changes?.first()?.get("experienceId"))
        assertEquals("personalization-id", reloadedStore.personalizations?.first()?.get("experienceId"))
        assertEquals("anonymous-id", reloadedStore.anonymousId)
    }
}

private class StoreTestContext : ContextWrapper(null) {
    private val sharedPreferences = InMemorySharedPreferences()

    override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
        require(name == "com.contentful.optimization")
        require(mode == Context.MODE_PRIVATE)

        return sharedPreferences
    }
}

private class InMemorySharedPreferences : SharedPreferences {
    private val values = mutableMapOf<String, Any?>()

    override fun getAll(): MutableMap<String, *> = values.toMutableMap()

    override fun getString(key: String?, defValue: String?): String? {
        return values[key] as? String ?: defValue
    }

    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? {
        @Suppress("UNCHECKED_CAST")
        return values[key] as? MutableSet<String> ?: defValues
    }

    override fun getInt(key: String?, defValue: Int): Int {
        return values[key] as? Int ?: defValue
    }

    override fun getLong(key: String?, defValue: Long): Long {
        return values[key] as? Long ?: defValue
    }

    override fun getFloat(key: String?, defValue: Float): Float {
        return values[key] as? Float ?: defValue
    }

    override fun getBoolean(key: String?, defValue: Boolean): Boolean {
        return values[key] as? Boolean ?: defValue
    }

    override fun contains(key: String?): Boolean {
        return values.containsKey(key)
    }

    override fun edit(): SharedPreferences.Editor {
        return Editor()
    }

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) {}

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?,
    ) {}

    private inner class Editor : SharedPreferences.Editor {
        private val edits = mutableMapOf<String, Any?>()
        private val removals = mutableSetOf<String>()
        private var clear = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
            if (key != null) edits[key] = value
        }

        override fun putStringSet(
            key: String?,
            values: MutableSet<String>?,
        ): SharedPreferences.Editor = apply {
            if (key != null) edits[key] = values
        }

        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
            if (key != null) edits[key] = value
        }

        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
            if (key != null) edits[key] = value
        }

        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
            if (key != null) edits[key] = value
        }

        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
            if (key != null) edits[key] = value
        }

        override fun remove(key: String?): SharedPreferences.Editor = apply {
            if (key != null) removals.add(key)
        }

        override fun clear(): SharedPreferences.Editor = apply {
            clear = true
        }

        override fun commit(): Boolean {
            if (clear) values.clear()

            for (key in removals) {
                values.remove(key)
            }

            for ((key, value) in edits) {
                if (value == null) {
                    values.remove(key)
                } else {
                    values[key] = value
                }
            }

            return true
        }

        override fun apply() {
            error("SharedPreferencesStore must commit durable SDK state writes synchronously")
        }
    }
}
