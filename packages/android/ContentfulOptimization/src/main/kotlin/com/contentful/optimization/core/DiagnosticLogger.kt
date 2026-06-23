package com.contentful.optimization.core

import android.util.Log

internal object DiagnosticLogger {
    private const val TAG = "ContentfulOptimization"

    @Volatile
    private var level = OptimizationLogLevel.error

    fun setLevel(level: OptimizationLogLevel) {
        this.level = level
    }

    fun debug(message: () -> String) {
        if (allows(OptimizationLogLevel.debug)) Log.d(TAG, message())
    }

    fun info(message: () -> String) {
        if (allows(OptimizationLogLevel.info)) Log.i(TAG, message())
    }

    fun warning(message: () -> String) {
        if (allows(OptimizationLogLevel.warn)) Log.w(TAG, message())
    }

    fun error(message: () -> String) {
        if (allows(OptimizationLogLevel.error)) Log.e(TAG, message())
    }

    private fun allows(messageLevel: OptimizationLogLevel): Boolean {
        return severity(messageLevel) >= severity(level)
    }

    private fun severity(level: OptimizationLogLevel): Int {
        return when (level) {
            OptimizationLogLevel.fatal -> 60
            OptimizationLogLevel.error -> 50
            OptimizationLogLevel.warn -> 40
            OptimizationLogLevel.info -> 30
            OptimizationLogLevel.debug -> 20
            OptimizationLogLevel.log -> 10
        }
    }
}
