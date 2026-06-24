package com.contentful.optimization.core

public sealed class OptimizationError(message: String) : Exception(message) {
    class NotInitialized : OptimizationError("SDK not initialized. Call initialize() first.")
    class BridgeError(msg: String) : OptimizationError("JS Bridge error: $msg")
    class ResourceLoadError(msg: String) : OptimizationError("Resource load error: $msg")
    class ConfigError(msg: String) : OptimizationError("Config error: $msg")
}
