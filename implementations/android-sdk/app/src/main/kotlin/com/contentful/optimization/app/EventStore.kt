package com.contentful.optimization.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

object EventStore {

    data class AnalyticsEvent(
        val type: String,
        val componentId: String?,
        val viewDurationMs: Int?,
        val viewId: String?,
        val timestamp: Long,
    )

    data class ComponentStats(
        var count: Int,
        var latestViewDurationMs: Int?,
        var latestViewId: String?,
    )

    private val _events = MutableStateFlow<List<AnalyticsEvent>>(emptyList())
    val events: StateFlow<List<AnalyticsEvent>> = _events.asStateFlow()

    private val _componentStats = MutableStateFlow<Map<String, ComponentStats>>(emptyMap())
    val componentStats: StateFlow<Map<String, ComponentStats>> = _componentStats.asStateFlow()

    private var collectJob: Job? = null

    fun subscribe(eventsFlow: SharedFlow<Map<String, Any>>, scope: CoroutineScope) {
        collectJob?.cancel()
        collectJob = scope.launch {
            eventsFlow.collect { dict -> processEvent(dict) }
        }
    }

    private fun processEvent(dict: Map<String, Any>) {
        val type = dict["type"] as? String ?: return

        val event = AnalyticsEvent(
            type = type,
            componentId = dict["componentId"] as? String,
            viewDurationMs = (dict["viewDurationMs"] as? Number)?.toInt(),
            viewId = dict["viewId"] as? String,
            timestamp = System.currentTimeMillis(),
        )

        _events.value = listOf(event) + _events.value

        if (type == "component") {
            val cid = event.componentId ?: return
            val current = _componentStats.value.toMutableMap()
            val stats = current[cid]?.copy() ?: ComponentStats(count = 0, null, null)
            stats.count++
            event.viewDurationMs?.let { stats.latestViewDurationMs = it }
            event.viewId?.let { stats.latestViewId = it }
            current[cid] = stats
            _componentStats.value = current
        }
    }
}
