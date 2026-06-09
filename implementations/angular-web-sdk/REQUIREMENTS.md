# Angular Web SDK — Requirements

Angular service/directive adapter over the raw `@contentful/optimization-web` SDK, mirroring the
React reference implementation.

---

## Prerequisites

Visual verification steps for features 3, 8, 9, 10, and 11 require the mock server to be running
with a seed experience that targets the identified user profile. Without an active experience the
variant state cannot be observed and negative assertions (e.g. "card does not change") are
unverifiable. Start the app with the mock server and use the `charles` user ID that is hardcoded in
the Identify call.

Terminology used throughout:

- **baseline** — the entry the SDK falls back to when no experience is active; shown with a grey
  `baseline` badge.
- **variant** — the resolved alternative when an experience is active; shown with a green `variant`
  badge.
- **clean session** — a browser session with no prior consent granted and no identified user (clear
  localStorage or use a private window).

---

## 1. SDK initialisation

- On load, the app initialises the SDK with the correct client credentials and API endpoints from
  environment config.
- If initialisation fails (bad credentials, network error), the app renders content using the
  baseline entries rather than crashing.
- The SDK is initialised exactly once per page load. This is a structural constraint enforced by a
  module-level singleton — it is not directly observable in the UI.

**Visual verification:**

1. Load the app — the page renders entry cards and the control panel shows **Active optimizations:
   0**. This confirms the SDK initialised successfully.
2. The app does not show a blank screen or an unhandled error — entries fall back to baseline
   content if the SDK fails.

---

## 2. Page tracking

- A page event is emitted when the app first loads.
- A page event is emitted each time the user navigates to a different route within the SPA.
- Page events are emitted regardless of whether the user has given consent.

**Visual verification:**

1. Start a clean session and load the app — the **Analytics Events** sidebar immediately shows a
   `page — /` event without any consent interaction.
2. Click **Page Two** in the nav — a `page — /page-two` event appears in the sidebar.
3. Click **Home** — another `page — /` event appears.
4. Click **Withdraw consent** (or leave consent at `undefined`) and navigate between routes — `page`
   events continue to appear regardless of consent state.

---

## 3. Entry resolution

- When a user has no active experience, the baseline entry content is shown.
- When a user matches an experience, the resolved variant content is shown instead of the baseline.
- After `identify()` or `reset()`, entries that have live updates enabled re-resolve and update
  their displayed content without a page reload. Seeing this requires **Global live updates** to be
  ON (see feature 9).

**Visual verification:**

1. On load, all entry cards show their baseline IDs in the left column (`base` label) and a grey
   `baseline` badge.
2. In the control panel, click **Global: OFF** to turn live updates ON.
3. Click **Identify** — entry cards with active experiences show a green left border and a green
   `variant` badge; the `var` and `exp` labels appear in the ID column.
4. Click **Reset** — cards revert to the grey `baseline` badge and the `var`/`exp` rows disappear.

---

## 4. Auto-tracking

- When an entry becomes visible in the viewport, a view event is emitted automatically.
- When the user clicks an entry, a click event is emitted automatically.
- When the user hovers over an entry, a hover event is emitted automatically.
- None of the above events are emitted before the user has given consent.

**Visual verification:**

1. Start a clean session — scroll through the **Auto-observed** section. No `component` events
   appear in the analytics sidebar (only `page` events are present).
2. Click **Grant consent** — the control panel shows **Consent: true**.
3. Scroll back to the Auto-observed section — `component` view events appear for each card as it
   enters the viewport.
4. Click an entry card — a `component_click` event appears in the sidebar.
5. Hover over a card — a `component_hover` event appears in the sidebar.

---

## 5. Manual tracking

- A designated set of entries is tracked via explicit SDK calls rather than DOM attributes.
- Those entries emit view events when they become visible, identical to auto-tracked view events.
- Manually-tracked entries do not emit click or hover events.
- Manually-tracked and auto-tracked entries coexist on the same page without interfering.

**Visual verification:**

1. Grant consent and scroll to the **Manually-observed** section.
2. `component` view events appear in the sidebar for the manually-observed cards, exactly as they do
   for auto-observed cards.
3. Click a manually-observed card — no `component_click` event appears (distinguishing manual from
   auto tracking).
4. Hover over a manually-observed card — no `component_hover` event appears.

---

## 6. Click scenarios

- Clicking the entry element itself emits a `component_click` event (direct scenario).
- Clicking a button inside the entry emits a `component_click` event (descendant scenario).
- Clicking an outer wrapper element that contains the entry emits a `component_click` event
  (ancestor scenario).
- All three scenarios are shown side-by-side in the **Auto-observed** section on the home page.

**Visual verification:**

1. Grant consent and go to the home page.
2. In the Auto-observed section, locate the three click-scenario cards — each shows a coloured badge
   indicating its scenario (`direct`, `descendant`, or `ancestor`).
3. Click directly on the **direct** card body — a `component_click` event appears in the sidebar.
4. Click the **Click me** button rendered inside the **descendant** card — a `component_click` event
   appears.
5. Click the visible outer border/wrapper that surrounds the **ancestor** card (outside the card
   itself, but inside the wrapper element) — a `component_click` event appears.

---

## 7. Consent

- On first load, no tracking events (views, clicks, hovers) are emitted.
- After the user grants consent, tracking begins immediately.
- After the user withdraws consent, tracking stops immediately.
- The current consent state is visible in the control panel at all times.
- Page events continue to fire regardless of consent state.

**Visual verification:**

1. Start a clean session — the control panel shows **Consent: undefined**. Scroll through all
   entries and confirm no `component` events appear in the sidebar (only `page` events).
2. Click **Grant consent** — the control panel shows **Consent: true**. Scroll over entries — view
   events start appearing.
3. Click **Withdraw consent** — the control panel shows **Consent: false**. Scroll over entries — no
   new view events appear.
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

1. Control panel shows **Identified: No** on a clean session load.
2. Click **Identify** — the button is replaced by **Reset** and the status changes to **Identified:
   Yes** immediately.
3. With **Global live updates ON**, entry cards with active experiences switch to their variant
   (green border, `variant` badge).
4. Click **Reset** — the button is replaced by **Identify** and the status returns to **Identified:
   No**; variant cards revert to baseline.
5. Click **Identify** again, then reload the page — the control panel shows **Identified: Yes**
   immediately on reload, confirming the SDK persisted the session.

---

## 9. Live updates — global toggle

- When live updates are off (default), an entry shows the variant it first resolved to and does not
  change even if the profile changes.
- When live updates are turned on, entries re-resolve and update their displayed content immediately
  when the profile changes.
- The label on the Default card in the Live updates section reflects the current global toggle
  state: **Default (ON)** or **Default (OFF)**.

**Visual verification:**

Prerequisite: an active experience must be configured for the entry shown in the Live updates
section for profile changes to produce an observable difference.

1. The **Live updates** section on the home page shows three labelled cards. The first card label
   reads **Default (OFF)**.
2. With global updates OFF, click **Identify** — the Default card does not change.
3. Click **Global: OFF** in the control panel — it toggles to **Global: ON** and the Default card
   label updates to **Default (ON)**.
4. Click **Reset** — the Default card updates its content immediately.

---

## 10. Live updates — per-entry override

- An entry marked "always live" updates its content on profile changes even when the global toggle
  is off.
- An entry marked "always locked" never updates its content even when the global toggle is on.
- An entry with no override follows the global toggle.
- All three modes are shown side-by-side in the **Live updates** section on the home page.

**Visual verification:**

Prerequisite: same active experience requirement as feature 9.

1. Ensure **Global live updates is OFF** in the control panel.
2. Click **Identify** — in the Live updates section, only the **Always live** card updates; the
   **Default** and **Always locked** cards stay frozen.
3. Click **Global: OFF** to turn it ON.
4. Click **Reset** — the **Default** and **Always live** cards update; the **Always locked** card
   remains frozen.
5. Confirm the Always locked card did not change in steps 2, 3, or 4 — it must stay frozen
   regardless of the global toggle state or profile changes.

---

## 11. Preview panel forced live

- With the preview panel open, an entry marked "always locked" still updates when the panel changes
  the active audience or variant.
- Closing the preview panel returns each entry to its configured live-update behaviour.

**Visual verification:**

Prerequisite: same active experience requirement as feature 9.

1. Ensure **Global live updates is OFF** in the control panel.
2. The **Always locked** card in the Live updates section should be frozen — click **Identify** and
   confirm the Always locked card does not change.
3. Click **Preview panel** — the Contentful panel slides in; status shows **Preview panel: Open**.
4. Click **Reset** — the Always locked card now updates its variant (it normally wouldn't).
5. Click **Preview panel** again to close it — status returns to **Closed**.
6. Click **Identify** — the Always locked card does **not** change, confirming it returned to its
   locked behaviour after the panel was closed.

---

## 12. Nested entries

- A parent entry and its nested child entries are all displayed.
- Each nested entry resolves to its own variant independently of the parent.
- The rendering recurses automatically based on the content model — no code changes are needed when
  nesting depth changes. This is a structural constraint, not directly verifiable by UI inspection.

**Visual verification:**

1. In the **Auto-observed** section on the home page, the first card renders as a tree — the
   top-level card shows a `nested` badge, and child entries are indented below it with their own
   cards and their own `base`/`var`/`exp` ID rows.
2. Turn **Global live updates ON** and click **Identify** — each nested level independently updates
   to its own variant (different entry IDs may resolve to different variants or stay at baseline).

---

## 13. Merge tags

- Rich text that contains a merge tag entry renders the personalised value at that position.
- When no personalised value is available, a visible fallback text `[Merge Tag]` is shown instead of
  blank content.

**Visual verification:**

1. Entry cards with merge tags show a yellow `merge tag` badge.
2. On a clean session, the inline merge tag position shows `[Merge Tag]`.
3. Turn **Global live updates ON** and click **Identify** — the merge tag placeholder is replaced
   with the resolved personalised value inline within the rich text.
4. Click **Reset** — the value reverts to `[Merge Tag]`.

---

## 14. Rich text rendering

- Rich text fields present in the seed content — including paragraphs, headings, lists, blockquotes,
  hyperlinks, and embedded merge tag entries — are rendered as formatted HTML.
- Embedded entry nodes that are merge tags are resolved as described in feature 13.

**Visual verification:**

1. Entry cards with a rich text field show a blue `rich text` badge.
2. The card body renders as formatted HTML — paragraphs, headings, and lists appear as styled
   elements, not raw JSON.
3. Merge tag nodes within the document are replaced with their resolved value (or `[Merge Tag]`
   fallback), not left as raw entry objects.

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

1. Start a clean session — the sidebar shows a single `page — /` event and both the list count and
   raw count equal 1.
2. Grant consent and hover over an entry for several seconds — a `component_hover` row appears and
   its duration updates in place while **Raw count** increases with each heartbeat.
3. Navigate to Page Two — a `page — /page-two` event appears; all previous events are still visible.
4. Click **Identify** — a `component` event for the boolean flag appears automatically (see feature
   19 for details).

---

## 16. Preview panel

- When the preview panel feature is enabled, the panel code is lazy-loaded on first attach. When the
  feature is disabled, no panel code is loaded. This is a structural/build constraint verifiable via
  the browser network tab — no preview bundle request should appear when the feature is disabled.
- The panel can be opened and closed without affecting the app's normal operation.
- While open, the panel drives live content updates as described in feature 11.

**Visual verification:**

1. Load the app — the control panel shows **Preview panel: Closed**.
2. Click **Preview panel** — the Contentful panel slides in on the right side of the page.
3. The control panel status updates to **Preview panel: Open**.
4. Click **Preview panel** again — the panel closes, status returns to **Closed**.

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

1. Click **Page Two** in the nav — the sidebar shows a `page — /page-two` event and a
   `component — page-two-conversion` event, both fired automatically on arrival.
2. The **Track conversion** button in the control panel is enabled. Click it — a second
   `component — page-two-conversion` event appears in the sidebar.
3. Navigate back to **Home** — the Track conversion button is greyed out; the full event history
   from Page Two is still visible in the sidebar.
4. Navigate to Page Two and back to Home several times — the sidebar does not show repeated SDK init
   entries, confirming the SDK is not re-initialised on route changes.

---

## 18. Locale consistency

- All Contentful entry fetches use the locale that the SDK has resolved for the current session.
- The Contentful CDA client is wrapped with the SDK's locale resolver so the two never diverge.

**Verification:** This is a structural constraint with no direct UI signal. Verify by code
inspection: `contentful-client.ts` wraps the raw Contentful client with
`sdk.withOptimizationLocale()` before any entry is fetched.

---

## 19. Feature flags

- The app subscribes to a flag named `'boolean'` via the SDK's flag state API.
- The current flag value is shown in the control panel as **Flag "boolean": \<value\>**.
- Accessing the flag automatically emits a view event to the event stream — no explicit tracking
  call is needed in application code.
- For anonymous sessions the SDK returns `undefined` for unresolved boolean flags. After identify,
  the flag resolves to its configured value for the identified profile.

**Visual verification:**

1. On a clean session, the control panel shows **Flag "boolean": undefined**.
2. Click **Identify** — the flag resolves to `true` (or its configured value) and the control panel
   updates immediately.
3. A `component` event for the flag appears in the analytics sidebar automatically — no button was
   clicked to cause this.
4. Click **Reset** — the flag returns to `undefined`.

---

## 20. Offline queue and recovery

SDK-native — no app code needed. The SDK queues events that fail to reach the Insights API while the
network is unavailable and delivers them when connectivity is restored.

**Verification:** Simulate in DevTools — open the Network tab, set the connection to **Offline**,
perform actions that generate events (scroll, click), restore the connection to **Online**, and
confirm the queued events arrive in the analytics sidebar.
