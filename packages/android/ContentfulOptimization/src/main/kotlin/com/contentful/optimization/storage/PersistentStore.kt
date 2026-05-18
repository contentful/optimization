package com.contentful.optimization.storage

interface PersistentStore {
    var profile: Map<String, Any>?
    var consent: Boolean?
    var changes: List<Map<String, Any>>?
    var personalizations: List<Map<String, Any>>?
    var anonymousId: String?
    var debug: Boolean

    fun load()
    fun clear()
}
