package com.contentful.optimization.app.views.support

import android.view.View
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat

/**
 * Expose [testTag] as this View's `viewIdResourceName` for UI Automator. Matches the Compose
 * reference impl's `Modifier.testTag("foo-bar")` + `testTagsAsResourceId = true` setup, so a
 * single test selector (`By.res("foo-bar")`) finds the matching element in both apps.
 *
 * Android `android:id` resource names cannot contain hyphens, so we cannot reuse the kebab-case
 * test-tag strings as XML ids. The standard accessibility plumbing — [AccessibilityNodeInfoCompat.setViewIdResourceName] —
 * lets us still report any string as the view-id resource name to accessibility consumers,
 * which is what UI Automator queries through `By.res`.
 */
fun View.setTestTag(testTag: String) {
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    ViewCompat.setAccessibilityDelegate(
        this,
        object : AccessibilityDelegateCompat() {
            override fun onInitializeAccessibilityNodeInfo(
                host: View,
                info: AccessibilityNodeInfoCompat,
            ) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.setViewIdResourceName(testTag)
            }
        },
    )
}
