package com.contentful.optimization.polyfills

import android.content.res.AssetManager
import com.contentful.optimization.core.OptimizationError

object PolyfillScriptLoader {
    private val fileNames = listOf(
        "console",
        "timers",
        "fetch",
        "crypto",
        "url",
        "abort-controller",
        "promise-utilities",
        "text-encoding",
    )

    fun loadAll(assets: AssetManager): List<String> {
        return fileNames.map { name ->
            try {
                assets.open("polyfills/$name.js").bufferedReader().use { it.readText() }
            } catch (e: Exception) {
                throw OptimizationError.ResourceLoadError(
                    "Missing or unreadable polyfill resource: polyfills/$name.js — ${e.message}"
                )
            }
        }
    }
}
