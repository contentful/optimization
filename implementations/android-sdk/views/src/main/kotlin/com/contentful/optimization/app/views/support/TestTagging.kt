package com.contentful.optimization.app.views.support

import android.os.Bundle
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
 *
 * Also: suppress the accessibility-triggered `ACTION_CLICK`. The shared UI Automator helper
 * `TestHelpers.tapElement` issues BOTH an accessibility click and a coordinate click on every
 * tap to defeat Compose's gesture debouncing. On a stock Android `Button`, both clicks fire the
 * `OnClickListener`, which silently double-fires every toggle. Compose's accessibility tree
 * routes the same action through a semantics handler that the gesture system effectively
 * deduplicates, so on the Compose impl one logical tap = one logical click. Treating the
 * accessibility click as a no-op gives the Views impl the same observable behavior, while
 * coordinate clicks still fire the listener normally (so TalkBack users can still operate the
 * UI through long-press / explore-by-touch).
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

            override fun performAccessibilityAction(
                host: View,
                action: Int,
                args: Bundle?,
            ): Boolean {
                if (action == AccessibilityNodeInfoCompat.ACTION_CLICK) return true
                return super.performAccessibilityAction(host, action, args)
            }
        },
    )
}
