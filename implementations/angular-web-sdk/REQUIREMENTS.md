# Web SDK Reference Implementation — Requirements

Verification requirements for the `@contentful/optimization-web` SDK reference implementation.

**Constraint (REFREQ-20):** The app must not add local shims, casts, or adapter logic to mask a
missing public SDK capability. All SDK interaction must go through public package APIs.

---

## Prerequisites

Features 3, 4, 10, 11, and 16 require the mock server running with a seed experience targeting the
identified user profile. Use the `charles` user ID hardcoded in the Identify call.

- **baseline** — fallback entry; grey `baseline` badge.
- **variant** — resolved alternative when an experience is active; green `variant` badge.
- **clean session** — no prior consent, no identified user (clear localStorage or private window).

---

## 1. SDK initialisation

- Initialises once per page load from environment config; enforced by a module-level singleton.
- Falls back to baseline rendering on init failure — no crash or blank screen.
- On teardown, the Angular service unsubscribes the router subscription, calls `sdk.destroy()` to
  flush queues and stop entry interaction tracking, and resets the singleton so the SDK can be
  recreated cleanly if needed.

**Verification:**

1. Load the app — entry cards render and control panel shows **Active optimizations: 0**.
2. No blank screen or error on init failure — entries show baseline.
3. Structural: SDK is created through the public Angular service; no private internals imported.
4. Teardown: navigate away and confirm no subscription leaks in DevTools.

---

## 2. Page tracking

- A `page` event fires on first load and on every route change, regardless of consent.

**Verification:**

1. Clean session — `page — /` appears in the sidebar immediately.
2. Navigate between routes — a `page` event appears for each change, with or without consent.

---

## 3. Entry resolution — SDK-automatic

- Baseline content shows when no experience is active.
- Variant content replaces baseline after `identify()` when live updates are on.

**Verification:**

1. Load — all cards show `baseline` badge.
2. Turn live updates ON, click **Identify** — active experience cards switch to `variant` with
   `var`/`exp` IDs.
3. Click **Reset** — cards revert to `baseline`.

---

## 4. Entry resolution — manual _(TODO)_

- The app calls `sdk.resolveOptimizedEntry(entry)` directly and renders the result.
- Resolution is triggered explicitly by app code, not automatically by the SDK.
- No variant selection logic in app code.

**Verification:**

1. The **Manually-resolved** section renders entries via the manual resolution path.
2. With live updates ON and after **Identify**, manually-resolved entries update to their variant.
3. Structural: resolution calls the SDK's public resolver service — no app-level resolution logic
   duplicated.

---

## 5. Entry tracking — attribute-based (auto)

- View, click, and hover events are emitted automatically via `data-ctfl-*` attributes when consent
  is granted.
- No events are emitted before consent.
- All tracking events stop immediately if consent is withdrawn.

**Verification:**

1. Clean session — scroll the **Auto-observed** section; no `component` events appear.
2. Grant consent, scroll — `component` view events appear as cards enter the viewport.
3. Click a card → `component_click`; hover → `component_hover`.

### Click scenarios

- `component_click` fires when clicking the entry directly (direct), a button inside it
  (descendant), or a wrapper around it (ancestor).

**Verification:**

1. Grant consent; locate the `direct`, `descendant`, `ancestor` cards in Auto-observed.
2. Click each — a `component_click` appears for every scenario.

---

## 6. Entry tracking — code-based (manual)

- Entries registered via explicit `enableElement` calls instead of `data-ctfl-*` attributes emit
  view events only; no click or hover events.

**Verification:**

1. Grant consent, scroll to **Manually-observed** — `component` view events appear.
2. Click or hover a manually-observed card — no `component_click` or `component_hover` appears.

---

## 8. Consent

- The app exposes a consent toggle; granting consent enables tracking, withdrawing disables it.
- Page events are unaffected by consent state and always fire.

**Verification:**

1. Clean session — no `component` events in sidebar regardless of scrolling.
2. Grant consent — view events appear on scroll.
3. Withdraw consent — no new `component` events; `page` events still fire on navigation.

---

## 9. Identify and reset

- `identify()` associates the session with a fixed user ID; `reset()` returns to anonymous.
- Both states persist across page reloads — SDK-managed storage, no app-level code required.

**Verification:**

1. Clean session shows **Identified: No**.
2. Click **Identify** → **Identified: Yes**; with live updates ON, variant cards update.
3. Click **Reset** → **Identified: No**; variant cards revert to baseline.
4. Identify, reload — panel shows **Identified: Yes** immediately.

---

## 10. Live updates — global toggle

- OFF (default): entry shows the variant it first resolved to; subsequent profile changes are
  ignored.
- ON: entries re-resolve immediately on profile change.

**Verification:**

Prerequisite: active experience required (see Prerequisites).

1. Global OFF, click **Identify** — Default card does not change.
2. Toggle **Global: ON** — Default card label updates to **Default (ON)**.
3. Click **Reset** — Default card updates immediately.

---

## 11. Live updates — per-entry override

- `always live`: updates on profile change even when global is OFF.
- `always locked`: never updates even when global is ON; does re-resolve when the preview panel is
  open.
- No override: follows the global toggle.

**Verification:**

Prerequisite: active experience required (see Prerequisites).

1. Global OFF, click **Identify** — only **Always live** updates; **Default** and **Always locked**
   stay frozen.
2. Toggle ON, click **Reset** — **Default** and **Always live** update; **Always locked** stays
   frozen.

---

## 12. Nested entries

- Parent and child entries are all displayed; each resolves to its own variant independently.

**Verification:**

1. Auto-observed first card shows `nested` badge with indented child entries, each with their own ID
   rows.
2. Live updates ON, click **Identify** — each nested level updates independently.

---

## 13. Merge tags

- Merge tag positions show `[Merge Tag]` when no value is resolved.
- After `identify()`, the fallback is replaced with the resolved personalised value inline.

**Verification:**

1. Clean session — merge tag cards (yellow badge) show `[Merge Tag]` inline.
2. Live updates ON, **Identify** — placeholder replaced with resolved value.
3. **Reset** — reverts to `[Merge Tag]`.

---

## 14. Rich text rendering

- Rich text fields render as formatted HTML (paragraphs, headings, lists, blockquotes, hyperlinks).
- Merge tag nodes within rich text are resolved as described in feature 13.

**Verification:**

1. Rich text cards (blue badge) render formatted HTML — not raw JSON.
2. Merge tag nodes show resolved value or `[Merge Tag]` fallback inline.

---

## 15. Analytics and diagnostics

- Every tracking event (page, view, click, hover) appears in the sidebar as it occurs.
- View and hover rows update in place (duration); **Raw count** increases faster than the
  deduplicated list.
- Events blocked by consent do not appear in the sidebar — the SDK's `eventStream` only emits
  delivered events; blocked events are routed to `blockedEventStream` and never reach the log.
- History persists across route changes.

**Verification:**

1. Clean session — sidebar shows `page — /`; both counts equal 1.
2. Without consent, scroll — no `component` events (blocked events do not appear).
3. Grant consent, hover an entry — `component_hover` row appears; duration updates in place while
   Raw count rises.
4. Navigate routes — prior events remain; `page` events append.

---

## 16. Preview panel

- Panel code is lazy-loaded on first open; no bundle loads when the feature is disabled (network
  tab).
- Opening the panel forces live re-resolution for all entries, overriding per-entry lock settings.
- Closing the panel restores each entry's configured live-update behaviour.
- The panel supports: audience activation/deactivation, variant override, variant reset, reset all,
  refresh, and remount — all handled by the panel itself; no app code required.

**Verification:**

Prerequisite: active experience required (see Prerequisites).

1. Load — **Preview panel: Closed**; open it — status updates to **Open**; close — **Closed**.
2. Global OFF, click **Identify** — **Always locked** does not change.
3. Open panel, click **Reset** — **Always locked** updates (forced live override in effect).
4. Close panel, click **Identify** — **Always locked** does not change (override removed).
5. Inside the open panel: activate an audience override — entry updates to the overridden variant;
   deactivate — entry reverts.
6. Apply a variant override, then reset — entry returns to its SDK-resolved variant.

---

## 17. Multi-route navigation

- Two routes: **Home** (`/`) and **Page Two** (`/page-two`).
- Arriving on Page Two auto-fires `component — page-two-conversion`; the **Track conversion** button
  fires an additional one.
- SDK is not re-initialised on route changes; event history is preserved.

**Verification:**

1. Click **Page Two** — sidebar shows `page — /page-two` and `component — page-two-conversion`
   automatically.
2. Click **Track conversion** — a second conversion event appears.
3. Navigate back and forth several times — no repeated SDK init entries; full history visible.

---

## 18. Locale consistency

- All CDA entry fetches use the SDK-resolved locale; the Contentful client is wrapped before any
  fetch.

**Verification:** Structural — the Contentful client is wrapped with `sdk.withOptimizationLocale()`
before entries are fetched.

---

## 19. Feature flags

- The app subscribes to a `'boolean'` flag via the SDK's flag state API; value shown in the control
  panel.
- Accessing the flag emits a view event automatically — no explicit tracking call in app code.

**Verification:**

1. Clean session — **Flag "boolean": undefined**.
2. **Identify** — flag resolves to `true`; `component` event appears automatically in the sidebar.
3. **Reset** — flag returns to `undefined`.

---
