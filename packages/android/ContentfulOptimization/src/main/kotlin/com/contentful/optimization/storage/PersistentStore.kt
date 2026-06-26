package com.contentful.optimization.storage

internal interface PersistentStore {
    var profile: Map<String, Any>?
    var consent: Boolean?
    var persistenceConsent: Boolean?
    var changes: List<Map<String, Any>>?
    var selectedOptimizations: List<Map<String, Any>>?
    var anonymousId: String?

    fun loadConsentState()
    fun loadProfileContinuity()
    fun clear()
    fun clearProfileContinuity()
}
