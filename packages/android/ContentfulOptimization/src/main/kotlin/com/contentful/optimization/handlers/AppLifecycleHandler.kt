package com.contentful.optimization.handlers

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AppLifecycleHandler(
    private val onBackground: suspend () -> Unit,
    private val onForeground: (() -> Unit)? = null,
) : DefaultLifecycleObserver {

    init {
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    }

    override fun onStop(owner: LifecycleOwner) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                onBackground()
            } catch (_: Exception) {
                // best-effort flush on background
            }
        }
    }

    override fun onStart(owner: LifecycleOwner) {
        onForeground?.invoke()
    }

    fun stop() {
        ProcessLifecycleOwner.get().lifecycle.removeObserver(this)
    }
}
