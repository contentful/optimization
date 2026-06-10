# Web SDK Reference Implementation — Requirements

Verification requirements for the `@contentful/optimization-web` SDK reference implementation.

---

## Prerequisites

Features 3, 8, 9, 10, and 11 require the mock server running with a seed experience targeting the
identified user profile. Use the `charles` user ID hardcoded in the Identify call.

Terminology used throughout:

- **baseline** — fallback entry when no experience is active; shown with a grey `baseline` badge.
- **variant** — resolved alternative when an experience is active; shown with a green `variant`
  badge.
- **clean session** — no prior consent and no identified user (clear localStorage or use a private
  window).

---

## 1. SDK initialisation

- On load, the app initialises the SDK with the correct client credentials and API endpoints from
  environment config.
- If initialisation fails (bad credentials, network error), the app renders content using the
  baseline entries rather than crashing.
- The SDK is initialised exactly once per page load. This is a structural constraint enforced by a
  module-level singleton — it is not directly observable in the UI.

**Visual verification:**

1. Load the app — entry cards render and the control panel shows **Active optimizations: 0**.
2. No blank screen or unhandled error — entries fall back to baseline if the SDK fails.

---

## 2. Page tracking

- A page event is emitted when the app first loads.
- A page event is emitted each time the user navigates to a different route within the SPA.
- Page events are emitted regardless of whether the user has given consent.

**Visual verification:**

1. Start a clean session — the sidebar immediately shows a `page — /` event without any consent
   interaction.
2. Navigate between **Page Two** and **Home** — a `page` event appears for each route change.
3. With consent withdrawn (or `undefined`), navigate between routes — `page` events continue to
   appear.

---

## 3. Entry resolution

- When a user has no active experience, the baseline entry content is shown.
- When a user matches an experience, the resolved variant content is shown instead of the baseline.
- After `identify()` or `reset()`, entries that have live updates enabled re-resolve and update
  their displayed content without a page reload. Seeing this requires **Global live updates** to be
  ON (see feature 9).

**Visual verification:**

1. On load, all entry cards show the `baseline` badge.
2. Turn live updates ON, then click **Identify** — cards with active experiences switch to the
   `variant` badge and show `var`/`exp` IDs.
3. Click **Reset** — cards revert to `baseline` and the `var`/`exp` rows disappear.

---

## 4. Auto-tracking

- When an entry becomes visible in the viewport, a view event is emitted automatically.
- When the user clicks an entry, a click event is emitted automatically.
- When the user hovers over an entry, a hover event is emitted automatically.
- None of the above events are emitted before the user has given consent.

**Visual verification:**

1. Start a clean session — scroll through the **Auto-observed** section; no `component` events
   appear (only `page`).
2. Click **Grant consent**, then scroll back — `component` view events appear as cards enter the
   viewport.
3. Click an entry card — a `component_click` event appears.
4. Hover over a card — a `component_hover` event appears.

---

## 5. Manual tracking

- A designated set of entries is tracked via explicit SDK calls rather than DOM attributes.
- Those entries emit view events when they become visible, identical to auto-tracked view events.
- Manually-tracked entries do not emit click or hover events.
- Manually-tracked and auto-tracked entries coexist on the same page without interfering.

**Visual verification:**

1. Grant consent and scroll to the **Manually-observed** section — `component` view events appear,
   same as auto-tracked.
2. Click a manually-observed card — no `component_click` event appears.
3. Hover over a manually-observed card — no `component_hover` event appears.

---

## 6. Click scenarios

- Clicking the entry element itself emits a `component_click` event (direct scenario).
- Clicking a button inside the entry emits a `component_click` event (descendant scenario).
- Clicking an outer wrapper element that contains the entry emits a `component_click` event
  (ancestor scenario).
- All three scenarios are shown side-by-side in the **Auto-observed** section on the home page.

**Visual verification:**

1. Grant consent and locate the three click-scenario cards in the Auto-observed section (`direct`,
   `descendant`, `ancestor` badges).
2. Click the **direct** card body — a `component_click` event appears.
3. Click the **Click me** button inside the **descendant** card — a `component_click` event appears.
4. Click the outer wrapper surrounding the **ancestor** card — a `component_click` event appears.

---

## 7. Consent

- On first load, no tracking events (views, clicks, hovers) are emitted.
- After the user grants consent, tracking begins immediately.
- After the user withdraws consent, tracking stops immediately.
- The current consent state is visible in the control panel at all times.
- Page events continue to fire regardless of consent state.

**Visual verification:**

1. Start a clean session — control panel shows **Consent: undefined**; scroll through all entries
   and confirm no `component` events appear.
2. Click **Grant consent** — scroll over entries; view events start appearing.
3. Click **Withdraw consent** — scroll over entries; no new view events appear.
4. Navigate to Page Two — a `page` event appears regardless of consent state.

---

## 8. Identify and reset

- After clicking Identify, the SDK associates the session with a fixed user ID and traits.
- The control panel shows **Identified: Yes** immediately after clicking Identify, and **No** after
  clicking Reset.
- After clicking Reset, the session returns to anonymous.
- Identified and anonymous states each resolve entries to the correct variant for that profile
  (requires live updates ON — see feature 9).
- Both states persist across page reloads. Persistence is managed by the SDK internally; no
  app-level code is required.

**Visual verification:**

1. Clean session shows **Identified: No**.
2. Click **Identify** — status changes to **Identified: Yes**; with live updates ON, variant cards
   update.
3. Click **Reset** — status returns to **No**; variant cards revert to baseline.
4. Click **Identify** again, then reload — control panel shows **Identified: Yes** immediately,
   confirming SDK persistence.

---

## 9. Live updates — global toggle

- When live updates are off (default), an entry shows the variant it first resolved to and does not
  change even if the profile changes.
- When live updates are turned on, entries re-resolve and update their displayed content immediately
  when the profile changes.
- The label on the Default card in the Live updates section reflects the current global toggle
  state: **Default (ON)** or **Default (OFF)**.

**Visual verification:**

Prerequisite: active experience required (see Prerequisites).

1. The **Live updates** section shows three cards; the first reads **Default (OFF)**.
2. With global updates OFF, click **Identify** — the Default card does not change.
3. Toggle to **Global: ON** — the Default card label updates to **Default (ON)**.
4. Click **Reset** — the Default card updates immediately.

---

## 10. Live updates — per-entry override

- An entry marked "always live" updates its content on profile changes even when the global toggle
  is off.
- An entry marked "always locked" never updates its content even when the global toggle is on.
- An entry with no override follows the global toggle.
- All three modes are shown side-by-side in the **Live updates** section on the home page.

**Visual verification:**

Prerequisite: active experience required (see Prerequisites).

1. With global updates OFF, click **Identify** — only the **Always live** card updates; **Default**
   and **Always locked** stay frozen.
2. Toggle global updates ON, then click **Reset** — **Default** and **Always live** update; **Always
   locked** remains frozen.
3. Confirm **Always locked** did not change at any point.

---

## 11. Preview panel forced live

- With the preview panel open, an entry marked "always locked" still updates when the panel changes
  the active audience or variant.
- Closing the preview panel returns each entry to its configured live-update behaviour.

**Visual verification:**

Prerequisite: active experience required (see Prerequisites).

1. With global updates OFF, click **Identify** — confirm **Always locked** does not change.
2. Open the **Preview panel** — status shows **Preview panel: Open**.
3. Click **Reset** — the Always locked card updates (override in effect).
4. Close the panel, then click **Identify** — **Always locked** does not change, confirming the
   override was removed.

---

## 12. Nested entries

- A parent entry and its nested child entries are all displayed.
- Each nested entry resolves to its own variant independently of the parent.
- The rendering recurses automatically based on the content model — no code changes are needed when
  nesting depth changes. This is a structural constraint, not directly verifiable by UI inspection.

**Visual verification:**

1. In the **Auto-observed** section, the first card shows a `nested` badge with indented child
   entries, each with their own `base`/`var`/`exp` ID rows.
2. Turn live updates ON and click **Identify** — each nested level independently updates to its own
   variant.

---

## 13. Merge tags

- Rich text that contains a merge tag entry renders the personalised value at that position.
- When no personalised value is available, a visible fallback text `[Merge Tag]` is shown instead of
  blank content.

**Visual verification:**

1. On a clean session, merge tag cards (yellow `merge tag` badge) show `[Merge Tag]` inline.
2. Turn live updates ON and click **Identify** — the placeholder is replaced with the resolved
   value.
3. Click **Reset** — reverts to `[Merge Tag]`.

---

## 14. Rich text rendering

- Rich text fields present in the seed content — including paragraphs, headings, lists, blockquotes,
  hyperlinks, and embedded merge tag entries — are rendered as formatted HTML.
- Embedded entry nodes that are merge tags are resolved as described in feature 13.

**Visual verification:**

1. Rich text cards (blue `rich text` badge) render as formatted HTML — not raw JSON.
2. Merge tag nodes are replaced with their resolved value or `[Merge Tag]` fallback (see feature
   13).

---

## 15. Analytics event display

- Every tracking event (page, view, click, hover) appears in the right sidebar as it occurs.
- View and hover events with the same view or hover ID show a single row that updates its duration
  rather than adding new rows for each heartbeat — the **Raw count** increases faster than the
  deduplicated list grows.
- The sidebar persists across route navigation and retains its full event history.
- Subscribing to the `'boolean'` flag (feature 19) emits a view event automatically — this appears
  in the sidebar without any explicit tracking call in application code.

**Visual verification:**

1. Clean session — sidebar shows a single `page — /` event; list count and raw count both equal 1.
2. Grant consent and hover over an entry — a `component_hover` row appears; its duration updates in
   place while **Raw count** increases.
3. Navigate to Page Two — a `page — /page-two` event appears; prior events are still visible.
4. Click **Identify** — a `component` event for the boolean flag appears automatically (feature 19).

---

## 16. Preview panel

- When the preview panel feature is enabled, the panel code is lazy-loaded on first attach. When the
  feature is disabled, no panel code is loaded. This is a structural/build constraint verifiable via
  the browser network tab — no preview bundle request should appear when the feature is disabled.
- The panel can be opened and closed without affecting the app's normal operation.
- While open, the panel drives live content updates as described in feature 11.

**Visual verification:**

1. Load the app — control panel shows **Preview panel: Closed**.
2. Click **Preview panel** — the panel slides in; status updates to **Open**.
3. Click again — panel closes, status returns to **Closed**.

---

## 17. Multi-route navigation

- The app has two routes — **Home** (`/`) and **Page Two** (`/page-two`) — navigable via the top
  nav.
- Navigating to Page Two emits a `page — /page-two` event.
- Arriving on Page Two automatically fires a conversion event with component ID
  `page-two-conversion` (visible in the sidebar as `component — page-two-conversion`).
- The **Track conversion** button in the control panel is active only on Page Two; clicking it fires
  an additional `component — page-two-conversion` event.
- Page Two renders one auto-tracked and one manually-tracked entry.
- Navigating back and forth does not cause duplicate SDK initialisations or lost event history.

**Visual verification:**

1. Click **Page Two** — sidebar shows a `page — /page-two` and a `component — page-two-conversion`
   event, both fired automatically.
2. Click **Track conversion** — a second `component — page-two-conversion` event appears.
3. Navigate back to **Home** — Track conversion is greyed out; full event history is still visible.
4. Navigate between routes several times — no repeated SDK init entries in the sidebar.

---

## 18. Locale consistency

- All Contentful entry fetches use the locale that the SDK has resolved for the current session.
- The Contentful CDA client is wrapped with the SDK's locale resolver so the two never diverge.

**Verification:** Structural constraint — verify by code inspection that the Contentful client is
wrapped with `sdk.withOptimizationLocale()` before any entry is fetched.

---

## 19. Feature flags

- The app subscribes to a flag named `'boolean'` via the SDK's flag state API.
- The current flag value is shown in the control panel as **Flag "boolean": \<value\>**.
- Accessing the flag automatically emits a view event to the event stream — no explicit tracking
  call is needed in application code.
- For anonymous sessions the SDK returns `undefined` for unresolved boolean flags. After identify,
  the flag resolves to its configured value for the identified profile.

**Visual verification:**

1. Clean session — control panel shows **Flag "boolean": undefined**.
2. Click **Identify** — flag resolves to `true` and a `component` event appears in the sidebar
   automatically.
3. Click **Reset** — flag returns to `undefined`.

---

## 20. Offline queue and recovery

SDK-native — no app code needed. The SDK queues events that fail to reach the Insights API while the
network is unavailable and delivers them when connectivity is restored.

**Verification:** Simulate in DevTools — open the Network tab, set the connection to **Offline**,
perform actions that generate events (scroll, click), restore the connection to **Online**, and
confirm the queued events arrive in the analytics sidebar.
