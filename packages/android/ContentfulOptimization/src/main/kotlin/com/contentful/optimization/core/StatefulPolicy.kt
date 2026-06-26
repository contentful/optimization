package com.contentful.optimization.core

public object ConsentStoragePolicy {
    public const val ACCEPTED: String = "accepted"
    public const val DENIED: String = "denied"

    public fun encode(consent: Boolean?): String? =
        consent?.let { if (it) ACCEPTED else DENIED }

    public fun decode(value: String?): Boolean? =
        when (value) {
            ACCEPTED -> true
            DENIED -> false
            else -> null
        }

    public fun resolvePersistedPersistenceConsent(
        persistenceConsent: Boolean?,
        consent: Boolean?,
    ): Boolean? = persistenceConsent ?: if (consent == true) true else null
}

public data class ResolvedStatefulDefaults(
    val defaults: StorageDefaults,
    val canLoadPersistedContinuity: Boolean,
)

public fun resolveStatefulDefaults(
    configured: StorageDefaults? = null,
    persisted: StorageDefaults = StorageDefaults(),
): ResolvedStatefulDefaults {
    val consent = configured?.consent ?: persisted.consent
    val persistenceConsent =
        configured?.persistenceConsent ?: configured?.consent ?: persisted.persistenceConsent
    val canLoadPersistedContinuity = persistenceConsent == true

    return ResolvedStatefulDefaults(
        defaults = StorageDefaults(
            consent = consent,
            persistenceConsent = persistenceConsent,
            profile = configured?.profile ?: if (canLoadPersistedContinuity) persisted.profile else null,
            changes = configured?.changes ?: if (canLoadPersistedContinuity) persisted.changes else null,
            selectedOptimizations =
                configured?.selectedOptimizations
                    ?: if (canLoadPersistedContinuity) persisted.selectedOptimizations else null,
        ),
        canLoadPersistedContinuity = canLoadPersistedContinuity,
    )
}
