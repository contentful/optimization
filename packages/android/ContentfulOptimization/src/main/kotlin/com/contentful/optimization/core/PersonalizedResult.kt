package com.contentful.optimization.core

data class PersonalizedResult(
    val entry: Map<String, Any>,
    val personalization: Map<String, Any>?,
)
