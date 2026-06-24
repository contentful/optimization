package com.contentful.optimization.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StatefulPolicyTest {

    @Test
    fun `consent storage policy encodes and decodes stable values`() {
        assertEquals("accepted", ConsentStoragePolicy.encode(true))
        assertEquals("denied", ConsentStoragePolicy.encode(false))
        assertNull(ConsentStoragePolicy.encode(null))

        assertEquals(true, ConsentStoragePolicy.decode("accepted"))
        assertEquals(false, ConsentStoragePolicy.decode("denied"))
        assertNull(ConsentStoragePolicy.decode("unknown"))
    }

    @Test
    fun `persistence consent falls back to accepted legacy event consent`() {
        assertEquals(true, ConsentStoragePolicy.resolvePersistedPersistenceConsent(null, true))
        assertNull(ConsentStoragePolicy.resolvePersistedPersistenceConsent(null, false))
        assertEquals(false, ConsentStoragePolicy.resolvePersistedPersistenceConsent(false, true))
        assertEquals(true, ConsentStoragePolicy.resolvePersistedPersistenceConsent(true, false))
    }

    @Test
    fun `stateful defaults prefer configured values and gate persisted continuity`() {
        val persisted = StorageDefaults(
            consent = true,
            persistenceConsent = true,
            profile = mapOf("id" to "stored-profile"),
            changes = listOf(mapOf("key" to "stored-change")),
            selectedOptimizations = listOf(mapOf("experienceId" to "stored-exp")),
        )

        val denied = resolveStatefulDefaults(
            configured = StorageDefaults(consent = false),
            persisted = persisted,
        )

        assertFalse(denied.canLoadPersistedContinuity)
        assertEquals(false, denied.defaults.consent)
        assertEquals(false, denied.defaults.persistenceConsent)
        assertNull(denied.defaults.profile)
        assertNull(denied.defaults.changes)
        assertNull(denied.defaults.selectedOptimizations)

        val accepted = resolveStatefulDefaults(persisted = persisted)

        assertTrue(accepted.canLoadPersistedContinuity)
        assertEquals(true, accepted.defaults.consent)
        assertEquals(true, accepted.defaults.persistenceConsent)
        assertEquals(persisted.profile, accepted.defaults.profile)
        assertEquals(persisted.changes, accepted.defaults.changes)
        assertEquals(persisted.selectedOptimizations, accepted.defaults.selectedOptimizations)
    }
}
