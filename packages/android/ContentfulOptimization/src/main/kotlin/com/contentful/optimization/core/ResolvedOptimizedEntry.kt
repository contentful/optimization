package com.contentful.optimization.core

public data class ResolvedOptimizedEntry(
    val entry: Map<String, Any>,
    val selectedOptimization: Map<String, Any>?,
    val optimizationContextId: String? = null,
)
