package com.contentful.optimization.handlers

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NetworkMonitor(
    context: Context,
    private val onConnectivityChanged: (isOnline: Boolean) -> Unit,
    private val onReconnected: suspend () -> Unit,
) {
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var wasConnected = true

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            CoroutineScope(Dispatchers.Main).launch {
                handleConnectivityChange(true)
            }
        }

        override fun onLost(network: Network) {
            CoroutineScope(Dispatchers.Main).launch {
                handleConnectivityChange(false)
            }
        }
    }

    init {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, callback)
    }

    private suspend fun handleConnectivityChange(isConnected: Boolean) {
        onConnectivityChanged(isConnected)

        if (isConnected && !wasConnected) {
            try {
                onReconnected()
            } catch (_: Exception) {
                // best-effort flush on reconnect
            }
        }
        wasConnected = isConnected
    }

    fun stop() {
        connectivityManager.unregisterNetworkCallback(callback)
    }
}
