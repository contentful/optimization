package com.contentful.optimization.bridge

import android.content.res.AssetManager
import com.dokar.quickjs.QuickJs
import com.dokar.quickjs.binding.define
import com.contentful.optimization.core.DiagnosticLogger
import com.contentful.optimization.core.OptimizationConfig
import com.contentful.optimization.core.OptimizationError
import com.contentful.optimization.core.PreviewState
import com.contentful.optimization.polyfills.NativeImpl
import com.contentful.optimization.polyfills.TimerStore
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.concurrent.Executors

class QuickJsContextManager {
    private var quickJs: QuickJs? = null
    private val callbackManager = BridgeCallbackManager()
    private var timerStore: TimerStore? = null

    private val quickJsThread = Executors.newSingleThreadExecutor { r ->
        Thread(r, "contentful-quickjs").apply { isDaemon = true }
    }
    val quickJsDispatcher: CoroutineDispatcher = quickJsThread.asCoroutineDispatcher()
    private var quickJsScope: CoroutineScope? = null

    var onLog: ((String, String) -> Unit)? = null
    var onStateChange: ((Map<String, Any>) -> Unit)? = null
    var onEvent: ((Map<String, Any>) -> Unit)? = null
    var onOverridesChanged: ((PreviewState) -> Unit)? = null

    suspend fun initialize(config: OptimizationConfig, assets: AssetManager) {
        withContext(quickJsDispatcher) {
            val qjs = QuickJs.create(quickJsDispatcher)
            val store = TimerStore()
            val scope = CoroutineScope(quickJsDispatcher)
            quickJsScope = scope
            timerStore = store

            val nativeImpl = NativeImpl(
                scope = scope,
                timerStore = store,
                evaluateJS = { script ->
                    @Suppress("UNCHECKED_CAST")
                    qjs.evaluate<Any?>(script, "native-callback.js")
                    Unit
                },
                logger = { level, msg -> onLog?.invoke(level, msg) },
            )

            qjs.define("__native") {
                function("log") { args: Array<Any?> ->
                    nativeImpl.log(args[0] as String, args[1] as String)
                }
                function("setTimeout") { args: Array<Any?> ->
                    nativeImpl.setTimeout((args[0] as Number).toInt(), (args[1] as Number).toInt())
                }
                function("clearTimeout") { args: Array<Any?> ->
                    nativeImpl.clearTimeout((args[0] as Number).toInt())
                }
                function("randomUUID") {
                    nativeImpl.randomUUID()
                }
                function("fetch") { args: Array<Any?> ->
                    nativeImpl.fetch(
                        args[0] as String,
                        args[1] as String,
                        args[2] as String,
                        args[3] as? String ?: "",
                        (args[4] as Number).toInt(),
                    )
                }
            }
            qjs.evaluate<Any?>(NativeImpl.BOOTSTRAP_SCRIPT, "native-bootstrap.js")

            val bundleSource = loadBundleSource(assets)
            qjs.evaluate<Any?>(bundleSource, "optimization-android-bridge.umd.js")

            val bridgeCheck = qjs.evaluate<String>("typeof __bridge", "bridge-check.js")
            if (bridgeCheck != "object") {
                qjs.close()
                throw OptimizationError.BridgeError(
                    "__bridge not found after bundle evaluation (got: $bridgeCheck)"
                )
            }

            registerCallbacks(qjs)

            val configJSON = config.toJSON()
            qjs.evaluate<Any?>("__bridge.initialize($configJSON)", "bridge-init.js")

            quickJs = qjs
        }
    }

    private suspend fun registerCallbacks(qjs: QuickJs) {
        qjs.evaluate<Any?>(
            """
            globalThis.__nativeOnStateChange = function(json) {
                __native.log("__stateChange__", json);
            };
            globalThis.__nativeOnEventEmitted = function(json) {
                __native.log("__eventEmitted__", json);
            };
            globalThis.__nativeOnOverridesChanged = function(json) {
                __native.log("__overridesChanged__", json);
            };
            """.trimIndent(),
            "callback-registration.js"
        )

        val originalOnLog = onLog
        onLog = { level, msg ->
            when (level) {
                "__stateChange__" -> handleStateChange(msg)
                "__eventEmitted__" -> handleEvent(msg)
                "__overridesChanged__" -> handleOverridesChanged(msg)
                else -> originalOnLog?.invoke(level, msg)
            }
        }
    }

    suspend fun callAsync(
        method: String,
        payload: String,
        completion: (Result<String>) -> Unit,
    ) {
        val qjs = quickJs
        if (qjs == null) {
            completion(Result.failure(OptimizationError.NotInitialized()))
            return
        }

        var didComplete = false
        val completeOnce: (Result<String>) -> Unit = { result ->
            if (!didComplete) {
                didComplete = true
                completion(result)
            }
        }

        val names = callbackManager.registerCallback(
            prefix = method,
            onSuccess = { json ->
                CoroutineScope(Dispatchers.Main).launch {
                    completeOnce(Result.success(json))
                }
            },
            onError = { errorMsg ->
                CoroutineScope(Dispatchers.Main).launch {
                    completeOnce(Result.failure(OptimizationError.BridgeError(errorMsg)))
                }
            },
        )

        withContext(quickJsDispatcher) {
            qjs.evaluate<Any?>(
                """
                globalThis.${names.success} = function(json) {
                    __native.log("__callback__${names.success}", json);
                };
                globalThis.${names.error} = function(errorMsg) {
                    __native.log("__callback__${names.error}", errorMsg);
                };
                """.trimIndent(),
                "callback-setup.js"
            )

            val originalOnLog = onLog
            val callbackOnLog: (String, String) -> Unit = { level, msg ->
                when (level) {
                    "__callback__${names.success}" -> {
                        callbackManager.invokeCallback(names.success, msg)
                        onLog = originalOnLog
                    }
                    "__callback__${names.error}" -> {
                        callbackManager.invokeCallback(names.error, msg)
                        onLog = originalOnLog
                    }
                    else -> originalOnLog?.invoke(level, msg)
                }
            }
            onLog = callbackOnLog

            val args = if (payload.isEmpty()) {
                "${names.success}, ${names.error}"
            } else {
                "$payload, ${names.success}, ${names.error}"
            }

            try {
                qjs.evaluate<Any?>("__bridge.$method($args)", "bridge-call-$method.js")
            } catch (e: Exception) {
                callbackManager.removeCallback(names.success, names.error)
                onLog = originalOnLog
                CoroutineScope(Dispatchers.Main).launch {
                    completeOnce(Result.failure(OptimizationError.BridgeError(e.message ?: "Unknown JS error")))
                }
            }
        }
    }

    suspend fun callSync(method: String, args: String = ""): String? {
        val qjs = quickJs ?: return null
        return withContext(quickJsDispatcher) {
            val script = if (args.isEmpty()) "__bridge.$method()" else "__bridge.$method($args)"
            try {
                val result = qjs.evaluate<Any?>(script, "bridge-sync-$method.js")
                result?.toString()
            } catch (e: Exception) {
                onLog?.invoke("exception", "[$method] ${e.message}")
                null
            }
        }
    }

    suspend fun evaluate(script: String): String? {
        val qjs = quickJs ?: return null
        return withContext(quickJsDispatcher) {
            try {
                qjs.evaluate<Any?>(script, "eval.js")?.toString()
            } catch (_: Exception) {
                null
            }
        }
    }

    suspend fun destroy() {
        withContext(quickJsDispatcher) {
            timerStore?.cancelAll()
            timerStore = null
            try {
                quickJs?.evaluate<Any?>("__bridge.destroy()", "bridge-destroy.js")
            } catch (_: Exception) {
                // ignore errors during teardown
            }
            quickJs?.close()
            quickJs = null
            quickJsScope?.cancel()
            quickJsScope = null
        }
    }

    private fun loadBundleSource(assets: AssetManager): String {
        return try {
            assets.open("optimization-android-bridge.umd.js").bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            throw OptimizationError.ResourceLoadError(
                "optimization-android-bridge.umd.js not found in assets: ${e.message}"
            )
        }
    }

    // The handlers below are dispatched from the QuickJS thread while a JS
    // call is still in flight. Invoking the registered native callback
    // synchronously here is what guarantees that StateFlow mutations have
    // landed by the time the calling `bridge.callSync` returns. Hopping to
    // Main would break that contract and reintroduce the panel-close race
    // documented in PreviewPanelOverridesTests scenario 3. StateFlow,
    // SharedFlow, and SharedPreferences are all safe to call from any thread.
    private fun handleStateChange(json: String) {
        val dict = parseJSONDict(json) ?: return
        onStateChange?.invoke(dict)
    }

    private fun handleEvent(json: String) {
        val dict = parseJSONDict(json) ?: return
        onEvent?.invoke(dict)
    }

    private fun handleOverridesChanged(json: String) {
        val state = PreviewState.fromJSON(json) ?: return
        onOverridesChanged?.invoke(state)
    }

    private fun parseJSONDict(json: String): Map<String, Any>? {
        return try {
            val obj = JSONObject(json)
            jsonObjectToMap(obj)
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        fun jsonObjectToMap(obj: JSONObject): Map<String, Any> {
            val map = mutableMapOf<String, Any>()
            for (key in obj.keys()) {
                val value = obj.get(key)
                map[key] = convertJSONValue(value)
            }
            return map
        }

        private fun convertJSONValue(value: Any): Any {
            return when (value) {
                is JSONObject -> jsonObjectToMap(value)
                is org.json.JSONArray -> {
                    (0 until value.length()).map { convertJSONValue(value.get(it)) }
                }
                JSONObject.NULL -> Unit
                else -> value
            }
        }
    }
}
