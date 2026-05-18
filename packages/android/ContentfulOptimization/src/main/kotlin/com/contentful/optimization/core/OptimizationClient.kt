package com.contentful.optimization.core

import android.content.Context
import com.contentful.optimization.bridge.ZiplineContextManager
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
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class OptimizationClient(private val applicationContext: Context) {

    private val _state = MutableStateFlow(OptimizationState.EMPTY)
    val state: StateFlow<OptimizationState> = _state.asStateFlow()

    private val _isInitialized = MutableStateFlow(false)
    val isInitialized: StateFlow<Boolean> = _isInitialized.asStateFlow()

    private val _selectedPersonalizations = MutableStateFlow<List<Map<String, Any>>?>(null)
    val selectedPersonalizations: StateFlow<List<Map<String, Any>>?> = _selectedPersonalizations.asStateFlow()

    private val _isPreviewPanelOpen = MutableStateFlow(false)
    val isPreviewPanelOpen: StateFlow<Boolean> = _isPreviewPanelOpen.asStateFlow()

    private val _previewState = MutableStateFlow<PreviewState?>(null)
    val previewState: StateFlow<PreviewState?> = _previewState.asStateFlow()

    private val _events = MutableSharedFlow<Map<String, Any>>(extraBufferCapacity = 64)
    val events: SharedFlow<Map<String, Any>> = _events.asSharedFlow()

    private val bridge = ZiplineContextManager()
    private val store = SharedPreferencesStore(applicationContext)
    private var appLifecycleHandler: AppLifecycleHandler? = null
    private var networkMonitor: NetworkMonitor? = null
    private val log = DiagnosticLogger

    init {
        bridge.onStateChange = { dict -> handleStateUpdate(dict) }
        bridge.onEvent = { dict -> _events.tryEmit(dict) }
        bridge.onOverridesChanged = { state -> _previewState.value = state }
    }

    // MARK: - Public API

    suspend fun initialize(config: OptimizationConfig) {
        log.setEnabled(config.debug)
        log.info { "[init] Starting SDK initialization (clientId=${config.clientId}, env=${config.environment})" }

        store.load()
        val mergedConfig = config.copy(
            defaults = (config.defaults ?: StorageDefaults()).let { d ->
                d.copy(
                    consent = d.consent ?: store.consent,
                    profile = d.profile ?: store.profile,
                    changes = d.changes ?: store.changes,
                    personalizations = d.personalizations ?: store.personalizations,
                )
            }
        )

        bridge.onLog = { level, msg -> log.debug { "[js:$level] $msg" } }

        bridge.initialize(mergedConfig, applicationContext.assets)
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

    suspend fun identify(
        userId: String,
        traits: Map<String, Any>? = null,
    ): Map<String, Any>? {
        return bridgeCallAsyncJSON("identify") {
            val obj = JSONObject()
            obj.put("userId", userId)
            traits?.let { obj.put("traits", JSONObject(it)) }
            obj.toString()
        }
    }

    suspend fun page(properties: Map<String, Any>? = null): Map<String, Any>? {
        return bridgeCallAsyncJSON("page") {
            JSONObject(properties ?: emptyMap<String, Any>()).toString()
        }
    }

    suspend fun screen(name: String, properties: Map<String, Any>? = null): Map<String, Any>? {
        return bridgeCallAsyncJSON("screen") {
            val obj = JSONObject()
            obj.put("name", name)
            properties?.let { obj.put("properties", JSONObject(it)) }
            obj.toString()
        }
    }

    suspend fun flush() {
        bridgeCallAsyncVoid("flush", "")
    }

    suspend fun trackView(payload: TrackViewPayload): Map<String, Any>? {
        return bridgeCallAsyncJSON("trackView") { payload.toJSON() }
    }

    suspend fun trackClick(payload: TrackClickPayload): Map<String, Any>? {
        return bridgeCallAsyncJSON("trackClick") { payload.toJSON() }
    }

    fun consent(accept: Boolean) {
        bridgeCallSyncWhenInitialized("consent", if (accept) "true" else "false")
    }

    fun reset() {
        if (!_isInitialized.value) return
        bridgeCallSyncWhenInitialized("reset")
        store.clear()
    }

    fun setOnline(isOnline: Boolean) {
        bridgeCallSyncWhenInitialized("setOnline", if (isOnline) "true" else "false")
    }

    suspend fun personalizeEntry(
        baseline: Map<String, Any>,
        personalizations: List<Map<String, Any>>? = null,
    ): PersonalizedResult {
        if (!_isInitialized.value) {
            return PersonalizedResult(entry = baseline, personalization = null)
        }

        return try {
            val baselineJSON = JSONObject(baseline).toString()
            val args = if (personalizations != null) {
                val pJSON = JSONArray(personalizations).toString()
                "$baselineJSON, $pJSON"
            } else {
                baselineJSON
            }

            val resultStr = bridge.callSync("personalizeEntry", args)
            if (resultStr == null || resultStr == "null" || resultStr == "undefined") {
                return PersonalizedResult(entry = baseline, personalization = null)
            }

            val dict = parseJSONDict(resultStr)
                ?: return PersonalizedResult(entry = baseline, personalization = null)

            @Suppress("UNCHECKED_CAST")
            val entry = dict["entry"] as? Map<String, Any> ?: baseline
            @Suppress("UNCHECKED_CAST")
            val personalization = dict["personalization"] as? Map<String, Any>
            PersonalizedResult(entry = entry, personalization = personalization)
        } catch (_: Exception) {
            PersonalizedResult(entry = baseline, personalization = null)
        }
    }

    suspend fun getProfile(): Map<String, Any>? {
        val result = bridge.callSync("getProfile")
        if (result == null || result == "null" || result == "undefined") return null
        return parseJSONDict(result)
    }

    fun getState(): OptimizationState = _state.value

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

        bridge.destroy()
        _isInitialized.value = false
        _state.value = OptimizationState.EMPTY
        _selectedPersonalizations.value = null
        store.clear()
    }

    // MARK: - Testing

    suspend fun testOnlySetLogHandler(handler: (String, String) -> Unit) {
        bridge.onLog = { level, msg ->
            log.debug { "[js:$level] $msg" }
            handler(level, msg)
        }
    }

    suspend fun testOnlyEvaluateScript(script: String): String? {
        return bridge.evaluate(script)
    }

    // MARK: - Private

    private fun requireInitialized() {
        if (!_isInitialized.value) throw OptimizationError.NotInitialized()
    }

    private fun bridgeCallSyncWhenInitialized(method: String, args: String = "") {
        if (!_isInitialized.value) return
        CoroutineScope(bridge.quickJsDispatcher).launch {
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

        _state.value = OptimizationState(
            profile = profile,
            consent = consent,
            canPersonalize = dict["canPersonalize"] as? Boolean ?: false,
            changes = changes,
        )

        @Suppress("UNCHECKED_CAST")
        val personalizations = extractJSONArray(dict["selectedPersonalizations"]) as? List<Map<String, Any>>
        _selectedPersonalizations.value = personalizations

        store.profile = profile
        store.consent = consent
        store.changes = changes
        store.personalizations = personalizations
        @Suppress("UNCHECKED_CAST")
        store.anonymousId = (profile?.get("id") as? String) ?: store.anonymousId
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

        fun parseJSONDict(json: String): Map<String, Any>? {
            if (json == "null") return null
            return try {
                ZiplineContextManager.jsonObjectToMap(JSONObject(json))
            } catch (_: Exception) {
                DiagnosticLogger.warning { "[parse] JSON parse failed — input: ${json.take(200)}" }
                null
            }
        }
    }
}
