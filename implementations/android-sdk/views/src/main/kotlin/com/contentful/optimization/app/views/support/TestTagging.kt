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
    // Belt-and-suspenders: surface the test tag through contentDescription too. The view also
    // gets the test tag as its `viewIdResourceName` via the AccessibilityDelegate below; this
    // covers the `By.desc` fallback for any caller (or environment) that doesn't see the
    // overridden resource-id name.
    if (contentDescription == null) {
        contentDescription = testTag
    }
    // Drop the framework-assigned resource id (set by android:id in XML). View.onInitializeAccessibilityNodeInfoInternal
    // populates AccessibilityNodeInfo#viewIdResourceName from `Resources.getResourceName(mID)`
    // every time the node info is built — even after our delegate's super call returns — and on
    // some platform builds (notably the API 35 x86_64 emulator image used in CI) that framework-
    // populated name appears to clobber our delegate override before UiAutomator's `By.res`
    // reads it. Setting `id = View.NO_ID` removes the framework's source value so the delegate's
    // `setViewIdResourceName(testTag)` is the only source the framework can use.
    id = View.NO_ID
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
