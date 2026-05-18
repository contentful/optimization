package com.contentful.optimization.bridge

import java.util.concurrent.atomic.AtomicInteger

class BridgeCallbackManager {
    private val nextId = AtomicInteger(1)
    private val callbacks = mutableMapOf<String, (String) -> Unit>()

    data class CallbackNames(val success: String, val error: String)

    fun registerCallback(
        prefix: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit,
    ): CallbackNames {
        val id = nextId.getAndIncrement()
        val successName = "__${prefix}Callback_${id}_success"
        val errorName = "__${prefix}Callback_${id}_error"

        callbacks[successName] = { json ->
            callbacks.remove(successName)
            callbacks.remove(errorName)
            onSuccess(json)
        }
        callbacks[errorName] = { errorMsg ->
            callbacks.remove(successName)
            callbacks.remove(errorName)
            onError(errorMsg)
        }

        return CallbackNames(successName, errorName)
    }

    fun invokeCallback(name: String, value: String): Boolean {
        val cb = callbacks[name] ?: return false
        cb(value)
        return true
    }

    fun removeCallback(successName: String, errorName: String) {
        callbacks.remove(successName)
        callbacks.remove(errorName)
    }
}
