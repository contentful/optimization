package com.contentful.optimization.polyfills

import com.contentful.optimization.core.DiagnosticLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class TimerStore {
    private val timers = ConcurrentHashMap<Int, Job>()

    fun set(id: Int, job: Job) {
        timers[id] = job
    }

    fun cancel(id: Int) {
        timers[id]?.cancel()
        timers.remove(id)
    }

    fun fired(id: Int) {
        timers.remove(id)
    }

    fun cancelAll() {
        for ((_, job) in timers) {
            job.cancel()
        }
        timers.clear()
    }
}

fun escapeForJS(value: String): String =
    value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")

class NativeImpl(
    private val scope: CoroutineScope,
    private val timerStore: TimerStore,
    private val evaluateJS: suspend (String) -> Unit,
    private val logger: (String, String) -> Unit,
) {
    private val okHttpClient = OkHttpClient()

    fun log(level: String, msg: String) {
        logger(level, msg)
    }

    fun setTimeout(id: Int, delayMs: Int) {
        val job = scope.launch {
            delay(delayMs.toLong().coerceAtLeast(0))
            timerStore.fired(id)
            evaluateJS("__timerFired($id)")
        }
        timerStore.set(id, job)
    }

    fun clearTimeout(id: Int) {
        timerStore.cancel(id)
    }

    fun randomUUID(): String = UUID.randomUUID().toString()

    fun fetch(url: String, method: String, headers: String, body: String, callbackId: Int) {
        DiagnosticLogger.debug { "[fetch] $method $url" }

        val requestBuilder = Request.Builder().url(url)

        try {
            val headersObj = JSONObject(headers)
            for (key in headersObj.keys()) {
                requestBuilder.addHeader(key, headersObj.getString(key))
            }
        } catch (_: Exception) {
            // headers was empty or invalid JSON — proceed without
        }

        val requestBody = if (body.isNotEmpty() && method != "GET" && method != "HEAD") {
            val contentType = "application/json".toMediaTypeOrNull()
            body.toRequestBody(contentType)
        } else {
            if (method == "POST" || method == "PUT" || method == "PATCH") {
                "".toRequestBody(null)
            } else {
                null
            }
        }

        val request = requestBuilder.method(method, requestBody).build()

        okHttpClient.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                val responseHeaders = JSONObject()
                for (name in response.headers.names()) {
                    responseHeaders.put(name, response.header(name))
                }
                val statusCode = response.code
                val bodySize = responseBody.length
                DiagnosticLogger.debug { "[fetch] Response $statusCode from $url ($bodySize bytes)" }
                if (statusCode >= 400) {
                    DiagnosticLogger.error { "[fetch] Error body: $responseBody" }
                }

                val escapedBody = escapeForJS(responseBody)
                val escapedHeaders = escapeForJS(responseHeaders.toString())

                scope.launch {
                    evaluateJS(
                        "__fetchComplete($callbackId, $statusCode, \"$escapedHeaders\", \"$escapedBody\", \"\")"
                    )
                }
            }

            override fun onFailure(call: Call, e: IOException) {
                DiagnosticLogger.error { "[fetch] Network error for $url: ${e.message}" }
                val escaped = escapeForJS(e.message ?: "Network error")
                scope.launch {
                    evaluateJS(
                        "__fetchComplete($callbackId, 0, \"{}\", \"\", \"$escaped\")"
                    )
                }
            }
        })
    }

    companion object {
        const val BOOTSTRAP_SCRIPT = """
            globalThis.__nativeLog          = function(l, m)        { return __native.log(l, m); };
            globalThis.__nativeSetTimeout   = function(id, ms)      { return __native.setTimeout(id, ms); };
            globalThis.__nativeClearTimeout = function(id)           { return __native.clearTimeout(id); };
            globalThis.__nativeRandomUUID   = function()             { return __native.randomUUID(); };
            globalThis.__nativeFetch        = function(u,m,h,b,cb)  { return __native.fetch(u, m, h, b, cb); };
        """
    }
}
