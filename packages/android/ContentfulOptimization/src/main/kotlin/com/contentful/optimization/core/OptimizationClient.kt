package com.contentful.optimization.core

import android.content.Context
import android.util.Log
import com.contentful.optimization.bridge.QuickJsContextManager
import com.contentful.optimization.handlers.AppLifecycleHandler
import com.contentful.optimization.handlers.NetworkMonitor
import com.contentful.optimization.polyfills.escapeForJS
import com.contentful.optimization.storage.SharedPreferencesStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

public data class EventEmissionResult(
    val accepted: Boolean,
    val data: Map<String, Any>?,
)

public class OptimizationClient(private val applicationContext: Context) {

    private val _state = MutableStateFlow(OptimizationState.EMPTY)
    val state: StateFlow<OptimizationState> = _state.asStateFlow()

    private val _isInitialized = MutableStateFlow(false)
    val isInitialized: StateFlow<Boolean> = _isInitialized.asStateFlow()

    var locale: String? = null
        private set

    private val _selectedOptimizations = MutableStateFlow<List<Map<String, Any>>?>(null)
    val selectedOptimizations: StateFlow<List<Map<String, Any>>?> = _selectedOptimizations.asStateFlow()

    private val _optimizationPossible = MutableStateFlow(false)
    val optimizationPossible: StateFlow<Boolean> = _optimizationPossible.asStateFlow()

    private val _experienceRequestState = MutableStateFlow<Map<String, Any>>(mapOf("status" to "idle"))
    val experienceRequestState: StateFlow<Map<String, Any>> = _experienceRequestState.asStateFlow()

    private val _isPreviewPanelOpen = MutableStateFlow(false)
    val isPreviewPanelOpen: StateFlow<Boolean> = _isPreviewPanelOpen.asStateFlow()

    private val _previewState = MutableStateFlow<PreviewState?>(null)
    val previewState: StateFlow<PreviewState?> = _previewState.asStateFlow()

    private val _eventStream = MutableSharedFlow<Map<String, Any>>(replay = 64, extraBufferCapacity = 64)
    val eventStream: SharedFlow<Map<String, Any>> = _eventStream.asSharedFlow()

    private val _blockedEventStream = MutableSharedFlow<BlockedEvent>(replay = 64, extraBufferCapacity = 64)
    val blockedEventStream: SharedFlow<BlockedEvent> = _blockedEventStream.asSharedFlow()

    private val bridge = QuickJsContextManager()
    private val store = SharedPreferencesStore(applicationContext)
    private var appLifecycleHandler: AppLifecycleHandler? = null
    private var networkMonitor: NetworkMonitor? = null
    private val log = DiagnosticLogger
    private val flagFlows = mutableMapOf<String, MutableStateFlow<JSONValue?>>()
    private val flagSubscriptionIdsByName = mutableMapOf<String, String>()
    private val flagNamesBySubscriptionId = mutableMapOf<String, String>()

    init {
        bridge.onStateChange = { dict -> handleStateUpdate(dict) }
        bridge.onEvent = { dict ->
            if (dict["type"] == "component") {
                Log.i("EventTrace", "bridge.onEvent component cid=${dict["componentId"]}")
            }
            _eventStream.tryEmit(dict)
        }
        bridge.onFlagValueChanged = { subscriptionId, value ->
            val name = flagNamesBySubscriptionId[subscriptionId]
            if (name != null) {
                flagFlows[name]?.value = value
            }
        }
        bridge.onOverridesChanged = { state -> _previewState.value = state }
    }

    // MARK: - Public API

    suspend fun initialize(config: OptimizationConfig) {
        log.setLevel(config.logLevel)
        log.info { "[init] Starting SDK initialization (clientId=${config.clientId}, env=${config.environment})" }

        store.loadConsentState()
        clearFlagObservers()
        val sdkLocale = config.normalizedLocale()
        val persistedConsentDefaults = StorageDefaults(
            consent = store.consent,
            persistenceConsent = store.persistenceConsent,
        )
        val initialDefaults = resolveStatefulDefaults(config.defaults, persistedConsentDefaults)
        var storedAnonymousId: String? = null
        val persistedDefaults = if (initialDefaults.canLoadPersistedContinuity) {
            store.loadProfileContinuity()
            storedAnonymousId = store.anonymousId
            StorageDefaults(
                consent = store.consent,
                persistenceConsent = store.persistenceConsent,
                profile = store.profile,
                changes = store.changes,
                selectedOptimizations = store.selectedOptimizations,
            )
        } else {
            if (initialDefaults.defaults.persistenceConsent == false) {
                store.clearProfileContinuity()
            }
            persistedConsentDefaults
        }
        val resolvedDefaults = resolveStatefulDefaults(config.defaults, persistedDefaults)
        val mergedConfig = config.copy(
            defaults = resolvedDefaults.defaults,
        )
        locale = sdkLocale

        bridge.onLog = { level, msg -> log.debug { "[js:$level] $msg" } }
        bridge.onEventBlocked = { event ->
            _blockedEventStream.tryEmit(event)
            config.onEventBlocked?.invoke(event)
        }
        bridge.onQueueEvent = { event ->
            when (event.type) {
                QueueEventType.offlineDrop -> config.queuePolicy?.onOfflineDrop?.invoke(event)
                QueueEventType.flushFailure -> config.queuePolicy?.onFlushFailure?.invoke(event)
                QueueEventType.circuitOpen -> config.queuePolicy?.onCircuitOpen?.invoke(event)
                QueueEventType.flushRecovered -> config.queuePolicy?.onFlushRecovered?.invoke(event)
            }
        }

        bridge.initialize(mergedConfig, applicationContext.assets, storedAnonymousId)
        _isInitialized.value = true
        log.info { "[init] SDK initialized successfully" }

        appLifecycleHandler = AppLifecycleHandler(
            onBackground = { flush() },
        )
        networkMonitor = NetworkMonitor(
            context = applicationContext,
            onConnectivityChanged = { isOnline -> setOnline(isOnline) },
            onReconnected = { flush() },
        )
    }

    suspend fun identify(payload: IdentifyPayload): EventEmissionResult {
        return bridgeCallAsyncJSON("identify") { payload.toJSON() }.toEventEmissionResult()
    }

    suspend fun identify(
        userId: String,
        traits: Map<String, Any>? = null,
    ): EventEmissionResult {
        return bridgeCallAsyncJSON("identify") {
            val obj = JSONObject()
            obj.put("userId", userId)
            traits?.let { obj.put("traits", JSONObject(it)) }
            obj.toString()
        }.toEventEmissionResult()
    }

    suspend fun page(payload: PageEventPayload): EventEmissionResult {
        return bridgeCallAsyncJSON("page") { payload.toJSON() }.toEventEmissionResult()
    }

    suspend fun page(properties: Map<String, Any>? = null): EventEmissionResult {
        return bridgeCallAsyncJSON("page") {
            JSONObject(properties ?: emptyMap<String, Any>()).toString()
        }.toEventEmissionResult()
    }

    suspend fun screen(payload: ScreenEventPayload): EventEmissionResult {
        return bridgeCallAsyncJSON("screen") { payload.toJSON() }.toEventEmissionResult()
    }

    suspend fun screen(name: String, properties: Map<String, Any>? = null): EventEmissionResult {
        return bridgeCallAsyncJSON("screen") {
            val obj = JSONObject()
            obj.put("name", name)
            properties?.let { obj.put("properties", JSONObject(it)) }
            obj.toString()
        }.toEventEmissionResult()
    }

    suspend fun track(payload: TrackEventPayload): EventEmissionResult {
        return bridgeCallAsyncJSON("track") { payload.toJSON() }.toEventEmissionResult()
    }

    suspend fun track(event: String, properties: Map<String, Any>? = null): EventEmissionResult {
        return bridgeCallAsyncJSON("track") {
            val obj = JSONObject()
            obj.put("event", event)
            properties?.let { obj.put("properties", JSONObject(it)) }
            obj.toString()
        }.toEventEmissionResult()
    }

    suspend fun trackCurrentScreen(payload: ScreenEventPayload): EventEmissionResult {
        return bridgeCallAsyncJSON("trackCurrentScreen") { payload.toJSON() }.toEventEmissionResult()
    }

    suspend fun trackCurrentScreen(
        name: String,
        properties: Map<String, Any>? = null,
        routeKey: String = name,
    ): EventEmissionResult {
        return bridgeCallAsyncJSON("trackCurrentScreen") {
            val obj = JSONObject()
            obj.put("routeKey", routeKey)
            obj.put("name", name)
            properties?.let { obj.put("properties", JSONObject(it)) }
            obj.toString()
        }.toEventEmissionResult()
    }

    suspend fun flush() {
        bridgeCallAsyncVoid("flush", "")
    }

    suspend fun trackView(payload: TrackViewPayload): EventEmissionResult {
        return bridgeCallAsyncJSON("trackView") { payload.toJSON() }.toEventEmissionResult()
    }

    suspend fun trackClick(payload: TrackClickPayload) {
        bridgeCallAsyncVoid("trackClick", payload.toJSON())
    }

    fun consent(accept: Boolean) {
        bridgeCallSyncWhenInitialized("consent", if (accept) "true" else "false")
    }

    fun consent(events: Boolean? = null, persistence: Boolean? = null) {
        val fields = mutableListOf<String>()
        events?.let { fields.add("events: ${if (it) "true" else "false"}") }
        persistence?.let { fields.add("persistence: ${if (it) "true" else "false"}") }
        bridgeCallSyncWhenInitialized("consent", "{${fields.joinToString(",")}}")
    }

    fun reset() {
        if (!_isInitialized.value) return
        bridgeCallSyncWhenInitialized("reset")
        store.clearProfileContinuity()
    }

    fun setOnline(isOnline: Boolean) {
        bridgeCallSyncWhenInitialized("setOnline", if (isOnline) "true" else "false")
    }

    fun setLocale(locale: String): String? {
        requireInitialized()
        val result = runBlocking(bridge.quickJsDispatcher) {
            bridge.callSync("setLocale", "'${escapeForJS(locale)}'")
        }
        if (result == null || result == "undefined") {
            throw OptimizationError.ConfigError("Failed to update locale")
        }
        val sdkLocale = result.takeUnless { it == "null" }
        this.locale = sdkLocale
        return sdkLocale
    }

    suspend fun resolveOptimizedEntry(
        baseline: Map<String, Any>,
        selectedOptimizations: List<Map<String, Any>>? = null,
    ): ResolvedOptimizedEntry {
        if (!_isInitialized.value) {
            return ResolvedOptimizedEntry(entry = baseline, selectedOptimization = null)
        }

        return try {
            val baselineJSON = JSONObject(baseline).toString()
            val args = if (selectedOptimizations != null) {
                val pJSON = JSONArray(selectedOptimizations).toString()
                "$baselineJSON, $pJSON"
            } else {
                baselineJSON
            }

            val resultStr = bridge.callSync("resolveOptimizedEntry", args)
            if (resultStr == null || resultStr == "null" || resultStr == "undefined") {
                return ResolvedOptimizedEntry(entry = baseline, selectedOptimization = null)
            }

            val dict = parseJSONDict(resultStr)
                ?: return ResolvedOptimizedEntry(entry = baseline, selectedOptimization = null)

            @Suppress("UNCHECKED_CAST")
            val entry = dict["entry"] as? Map<String, Any> ?: baseline
            @Suppress("UNCHECKED_CAST")
            val selectedOptimization = dict["selectedOptimization"] as? Map<String, Any>
            val optimizationContextId = dict["optimizationContextId"] as? String
            ResolvedOptimizedEntry(
                entry = entry,
                selectedOptimization = selectedOptimization,
                optimizationContextId = optimizationContextId,
            )
        } catch (_: Exception) {
            ResolvedOptimizedEntry(entry = baseline, selectedOptimization = null)
        }
    }

    /** Resolve a merge-tag entry's display value against the current profile. */
    suspend fun getMergeTagValue(mergeTagEntry: Map<String, Any>): String? {
        if (!_isInitialized.value) return null
        return try {
            val result = bridge.callSync("getMergeTagValue", JSONObject(mergeTagEntry).toString())
            if (result == null || result == "null" || result == "undefined") null else result
        } catch (_: Exception) {
            null
        }
    }

    /** Resolve a feature flag value by name. Emits a flag-view `component` event. */
    fun getFlag(name: String): JSONValue? {
        if (!_isInitialized.value) return null
        val escapedName = escapeForJS(name)
        val result = runBlocking(bridge.quickJsDispatcher) {
            bridge.callSync("getFlag", "'$escapedName'")
        }
        return parseJSONValue(result)
    }

    /** Observe a feature flag value by name. Emits flag-view events for delivered values. */
    fun observeFlag(name: String): StateFlow<JSONValue?> {
        requireInitialized()
        flagFlows[name]?.let { return it.asStateFlow() }

        val flow = MutableStateFlow<JSONValue?>(null)
        val subscriptionId = UUID.randomUUID().toString()
        flagFlows[name] = flow
        flagSubscriptionIdsByName[name] = subscriptionId
        flagNamesBySubscriptionId[subscriptionId] = name
        bridgeCallSyncWhenInitialized(
            "observeFlag",
            "'${escapeForJS(subscriptionId)}', '${escapeForJS(name)}'",
        )
        return flow.asStateFlow()
    }

    suspend fun getProfile(): Map<String, Any>? {
        val result = bridge.callSync("getProfile")
        if (result == null || result == "null" || result == "undefined") return null
        return parseJSONDict(result)
    }

    fun getState(): OptimizationState = _state.value

    fun hasConsent(method: String): Boolean {
        if (!_isInitialized.value) return false
        val escapedMethod = escapeForJS(method)
        val result = runBlocking(bridge.quickJsDispatcher) {
            bridge.callSync("hasConsent", "'$escapedMethod'")
        }
        return result == "true"
    }

    // MARK: - Preview Panel

    fun setPreviewPanelOpen(open: Boolean) {
        _isPreviewPanelOpen.value = open
        bridgeCallSyncWhenInitialized("setPreviewPanelOpen", if (open) "true" else "false")
    }

    fun overrideAudience(id: String, qualified: Boolean, experienceIds: List<String>) {
        val escapedId = escapeForJS(id)
        val escapedIds = experienceIds.joinToString(",") { "'${escapeForJS(it)}'" }
        bridgeCallSyncWhenInitialized("overrideAudience", "'$escapedId', $qualified, [$escapedIds]")
    }

    fun overrideVariant(experienceId: String, variantIndex: Int) {
        val escapedId = escapeForJS(experienceId)
        bridgeCallSyncWhenInitialized("overrideVariant", "'$escapedId', $variantIndex")
    }

    fun resetAudienceOverride(id: String) {
        val escapedId = escapeForJS(id)
        bridgeCallSyncWhenInitialized("resetAudienceOverride", "'$escapedId'")
    }

    fun resetVariantOverride(experienceId: String) {
        val escapedId = escapeForJS(experienceId)
        bridgeCallSyncWhenInitialized("resetVariantOverride", "'$escapedId'")
    }

    fun resetAllOverrides() {
        bridgeCallSyncWhenInitialized("resetAllOverrides")
    }

    suspend fun loadDefinitions(
        audiences: List<Map<String, Any>>,
        experiences: List<Map<String, Any>>,
    ) {
        val audienceJSON = JSONArray(audiences).toString()
        val experienceJSON = JSONArray(experiences).toString()
        bridge.callSync("loadDefinitions", "$audienceJSON, $experienceJSON")
    }

    suspend fun refreshPreviewState() {
        _previewState.value = getPreviewState()
    }

    suspend fun getPreviewState(): PreviewState? {
        val result = bridge.callSync("getPreviewState")
        if (result == null || result == "null" || result == "undefined") {
            log.warning { "[preview] getPreviewState returned nil" }
            return null
        }
        return PreviewState.fromJSON(result)
    }

    suspend fun destroy() {
        appLifecycleHandler?.stop()
        appLifecycleHandler = null
        networkMonitor?.stop()
        networkMonitor = null

        for (subscriptionId in flagSubscriptionIdsByName.values) {
            bridge.callSync("unobserveFlag", "'${escapeForJS(subscriptionId)}'")
        }
        clearFlagObservers()
        bridge.destroy()
        _isInitialized.value = false
        _state.value = OptimizationState.EMPTY
        locale = null
        _selectedOptimizations.value = null
        _optimizationPossible.value = false
        _experienceRequestState.value = mapOf("status" to "idle")
    }

    // MARK: - Testing

    internal suspend fun testOnlySetLogHandler(handler: (String, String) -> Unit) {
        bridge.onLog = { level, msg ->
            log.debug { "[js:$level] $msg" }
            handler(level, msg)
        }
    }

    internal suspend fun testOnlyEvaluateScript(script: String): String? {
        return bridge.evaluate(script)
    }

    // MARK: - Private

    private fun requireInitialized() {
        if (!_isInitialized.value) throw OptimizationError.NotInitialized()
    }

    private fun bridgeCallSyncWhenInitialized(method: String, args: String = "") {
        if (!_isInitialized.value) return
        // Block on the QuickJS dispatcher so that any state mutations produced
        // by the JS call (and the synchronous `__nativeOnStateChange` callback
        // it triggers) have settled into our StateFlows before this function
        // returns. Matches iOS's `JSContext.evaluateScript` semantics, where
        // state callbacks fire before the bridge call returns to the caller.
        runBlocking(bridge.quickJsDispatcher) {
            bridge.callSync(method, args)
        }
    }

    private suspend fun bridgeCallAsyncJSON(
        method: String,
        buildPayload: () -> String,
    ): Map<String, Any>? {
        requireInitialized()
        val payload = buildPayload()
        log.debug { "[bridge] Calling $method async" }
        return withContext(Dispatchers.Main) {
            suspendCoroutine { continuation ->
                CoroutineScope(bridge.quickJsDispatcher).launch {
                    bridge.callAsync(method, payload) { result ->
                        result.fold(
                            onSuccess = { json ->
                                log.debug { "[bridge] $method succeeded (${json.take(200)})" }
                                continuation.resume(parseJSONDict(json))
                            },
                            onFailure = { error ->
                                log.error { "[bridge] $method failed: ${error.message}" }
                                continuation.resumeWithException(error)
                            }
                        )
                    }
                }
            }
        }
    }

    private fun Map<String, Any>?.toEventEmissionResult(): EventEmissionResult {
        @Suppress("UNCHECKED_CAST")
        return EventEmissionResult(
            accepted = this?.get("accepted") as? Boolean ?: false,
            data = this?.get("data") as? Map<String, Any>,
        )
    }

    private suspend fun bridgeCallAsyncVoid(method: String, payload: String) {
        requireInitialized()
        withContext(Dispatchers.Main) {
            suspendCoroutine { continuation ->
                CoroutineScope(bridge.quickJsDispatcher).launch {
                    bridge.callAsync(method, payload) { result ->
                        result.fold(
                            onSuccess = { continuation.resume(Unit) },
                            onFailure = { continuation.resumeWithException(it) }
                        )
                    }
                }
            }
        }
    }

    private fun handleStateUpdate(dict: Map<String, Any>) {
        @Suppress("UNCHECKED_CAST")
        val profile = extractJSONValue(dict["profile"]) as? Map<String, Any>
        @Suppress("UNCHECKED_CAST")
        val changes = extractJSONArray(dict["changes"]) as? List<Map<String, Any>>
        val consent = dict["consent"] as? Boolean
        val persistenceConsent = dict["persistenceConsent"] as? Boolean
        val locale = dict["locale"] as? String
        @Suppress("UNCHECKED_CAST")
        val selectedOptimizations = extractJSONArray(dict["selectedOptimizations"]) as? List<Map<String, Any>>
        val optimizationPossible = dict["optimizationPossible"] as? Boolean ?: false
        @Suppress("UNCHECKED_CAST")
        val experienceRequestState =
            extractJSONValue(dict["experienceRequestState"]) as? Map<String, Any>
                ?: mapOf("status" to "idle")

        this.locale = locale

        store.consent = consent
        store.persistenceConsent = persistenceConsent
        if (persistenceConsent == true) {
            store.profile = profile
            store.changes = changes
            store.selectedOptimizations = selectedOptimizations
            @Suppress("UNCHECKED_CAST")
            store.anonymousId = (profile?.get("id") as? String) ?: store.anonymousId
        } else if (persistenceConsent == false) {
            store.clearProfileContinuity()
        }

        _selectedOptimizations.value = selectedOptimizations
        _optimizationPossible.value = optimizationPossible
        _experienceRequestState.value = experienceRequestState
        _state.value = OptimizationState(
            profile = profile,
            consent = consent,
            persistenceConsent = persistenceConsent,
            canOptimize = dict["canOptimize"] as? Boolean ?: false,
            optimizationPossible = optimizationPossible,
            experienceRequestState = experienceRequestState,
            changes = changes,
            selectedOptimizations = selectedOptimizations,
            locale = locale,
        )
    }

    private fun clearFlagObservers() {
        flagFlows.clear()
        flagSubscriptionIdsByName.clear()
        flagNamesBySubscriptionId.clear()
    }

    companion object {
        private fun extractJSONValue(value: Any?): Any? {
            if (value == null || value == Unit) return null
            return value
        }

        private fun extractJSONArray(value: Any?): Any? {
            if (value == null || value == Unit) return null
            return value
        }

        internal fun parseJSONDict(json: String): Map<String, Any>? {
            if (json == "null") return null
            return try {
                QuickJsContextManager.jsonObjectToMap(JSONObject(json))
            } catch (_: Exception) {
                DiagnosticLogger.warning { "[parse] JSON parse failed — input: ${json.take(200)}" }
                null
            }
        }

        private fun parseJSONValue(json: String?): JSONValue? {
            if (json == null || json == "undefined") return null
            return try {
                JSONValue.fromAny(JSONTokener(json).nextValue())
            } catch (_: Exception) {
                DiagnosticLogger.warning { "[parse] JSON value parse failed — input: ${json.take(200)}" }
                null
            }
        }
    }
}
