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
    // Belt-and-suspenders: surface the test tag through contentDescription too. Some emulator
    // configurations (notably the headless x86_64 emulator-runner image used in CI) appear to
    // ignore the AccessibilityDelegate-driven `viewIdResourceName` override on certain XML
    // views, so UiAutomator's `By.res("foo-bar")` lookups return null even though
    // `Modifier.testTag("foo-bar") + testTagsAsResourceId = true` resolves on the Compose side.
    // Setting contentDescription too means the existing `TestHelpers.findElement` fallback
    // (`By.res` → `By.desc` → `By.text`) catches the view via `By.desc("foo-bar")`. We only
    // assign when contentDescription is null so per-view content descriptions (entry text,
    // accessibility identifiers on OptimizedEntryView, etc.) are preserved.
    if (contentDescription == null) {
        contentDescription = testTag
    }
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
