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
    // Belt-and-suspenders: surface the test tag through contentDescription too. The view also
    // gets the test tag as its `viewIdResourceName` via the AccessibilityDelegate below; this
    // covers the `By.desc` fallback for any caller (or environment) that doesn't see the
    // overridden resource-id name. This overwrites any existing `contentDescription`, which is
    // acceptable because this helper is only called in test builds of the views reference impl,
    // where the test tag is the canonical accessibility identifier.
    contentDescription = testTag
    // Drop the framework-assigned resource id (set by android:id in XML). View.onInitializeAccessibilityNodeInfoInternal
    // populates AccessibilityNodeInfo#viewIdResourceName from `Resources.getResourceName(mID)`
    // every time the node info is built — even after our delegate's super call returns — and on
    // some platform builds (notably the API 35 x86_64 emulator image used in CI) that framework-
    // populated name appears to clobber our delegate override before UiAutomator's `By.res`
    // reads it. Setting `id = View.NO_ID` removes the framework's source value so the delegate's
    // `setViewIdResourceName(testTag)` is the only source the framework can use.
    // Side effect: `findViewById` will no longer resolve this view — acceptable in the views reference impl because tag lookup runs through UIAutomator, not Android view lookups.
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
        },
    )
}
