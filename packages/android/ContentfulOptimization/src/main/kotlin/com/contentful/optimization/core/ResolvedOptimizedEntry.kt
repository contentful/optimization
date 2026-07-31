package com.contentful.optimization.core

import com.contentful.optimization.contentful.CTEntry

/**
 * The result of resolving an optimized entry. [entry] is a [CTEntry] regardless of whether the
 * baseline was a raw `Map<String, Any>` or a `CDAEntry`; both paths wrap their output the same
 * way, so downstream reads through `getField` / `hasField` / `id` instead of `as?` casts on a raw
 * map.
 */
public data class ResolvedOptimizedEntry(
    val entry: CTEntry,
    val selectedOptimization: Map<String, Any>?,
    val optimizationContextId: String? = null,
)
