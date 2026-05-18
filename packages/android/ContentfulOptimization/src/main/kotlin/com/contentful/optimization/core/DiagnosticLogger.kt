package com.contentful.optimization.core

import android.util.Log

object DiagnosticLogger {
    private const val TAG = "ContentfulOptimization"

    @Volatile
    private var enabled = false

    fun setEnabled(enabled: Boolean) {
        this.enabled = enabled
    }

    fun debug(message: () -> String) {
        if (enabled) Log.d(TAG, message())
    }

    fun info(message: () -> String) {
        if (enabled) Log.i(TAG, message())
    }

    fun warning(message: () -> String) {
        if (enabled) Log.w(TAG, message())
    }

    fun error(message: () -> String) {
        if (enabled) Log.e(TAG, message())
    }
}
