package com.contentful.optimization.app.views

import android.app.Application

/**
 * Application class for the Views reference impl. The SDK itself is initialized lazily by
 * [MainActivity] so the `--ez reset true` launch flag has a chance to clear the SDK's
 * SharedPreferences BEFORE `OptimizationManager.initialize` reads them via the bridge.
 *
 * Compose handles this implicitly because `OptimizationRoot` constructs the client inside the
 * Compose tree, after the activity's `onCreate` has run — preserving the same ordering here
 * keeps `clearProfileState`/`relaunchClean` working identically across both reference impls.
 */
class ViewsApplication : Application()
