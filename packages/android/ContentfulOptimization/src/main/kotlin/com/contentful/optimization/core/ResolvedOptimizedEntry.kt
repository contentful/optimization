package com.contentful.optimization.core

import com.contentful.optimization.contentful.CTEntry

public data class ResolvedOptimizedEntry(
    val entry: CTEntry,
    val selectedOptimization: Map<String, Any>?,
    val optimizationContextId: String? = null,
)
