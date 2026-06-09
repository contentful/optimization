# Angular Web SDK — Requirements

Angular service/directive adapter over the raw `@contentful/optimization-web` SDK, mirroring the
React reference implementation.

---

## 1. SDK initialisation

- On load, the app initialises the SDK with the correct client credentials and API endpoints from
  environment config.
- If initialisation fails (bad credentials, network error), the app renders content using the
  baseline entries rather than crashing.
- The SDK is initialised exactly once — reloading the page does not create a second instance.

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

1. Load the app — the **Analytics Events** sidebar immediately shows a `page — /` event (no consent
   required).
2. Click **Page Two** in the nav — a second `page — /page-two` event appears in the sidebar.
3. Click **Home** — a `page — /` event appears again.

---

## 3. Entry resolution

- When a user has no active experience, the baseline entry content is shown.
- When a user matches an experience, the resolved variant content is shown instead of the baseline.
- After `identify()` or `reset()`, entries that have live updates enabled re-resolve and update
  their displayed content without a page reload.

**Visual verification:**

1. On load, all entry cards show their baseline IDs in the left column (`base` label).
2. Click **Global: OFF** in the control panel to turn live updates ON.
3. Click **Identify** — entry cards with active experiences show a green left border and a `variant`
   badge; the `var` and `exp` labels appear in the ID column.
4. Click **Reset** — cards revert to `baseline` badge and the `var`/`exp` rows disappear.

---

## 4. Auto-tracking

- When an entry becomes visible in the viewport, a view event is emitted automatically.
- When the user clicks an entry, a click event is emitted automatically.
- When the user hovers over an entry, a hover event is emitted automatically.
- None of the above events are emitted before the user has given consent.

**Visual verification:**

1. Load the app without granting consent — scroll through the **Auto-observed** section. No
   `component` events appear in the analytics sidebar.
2. Click **Grant consent** — the control panel shows **Consent: true**.
3. Scroll back to the Auto-observed section — `component` view events appear for each card as it
   enters the viewport.
4. Click an entry card — a `component_click` event appears.
5. Hover over a card — `component_hover` events appear and update their duration in place.

---

## 5. Manual tracking

- A designated set of entries is tracked via explicit SDK calls rather than DOM attributes.
- Those entries emit view events when they become visible, identical to auto-tracked view events.
- Manually-tracked entries do not emit click or hover events.
- Manually-tracked and auto-tracked entries coexist on the same page without interfering.

**Visual verification:**

1. Grant consent and scroll to the **Manually-observed** section.
2. `component` view events appear in the analytics sidebar for the manually-observed cards, exactly
   as they do for auto-observed cards.
3. Clicking a manually-observed card does **not** add a `component_click` event (distinguishing
   manual from auto tracking).

---

## 6. Click scenarios

- Clicking the entry element itself emits a `component_click` event (direct click scenario).
- Clicking a button inside the entry emits a `component_click` event (descendant click scenario).
- Clicking a wrapper element that contains the entry emits a `component_click` event (ancestor click
  scenario).
- All three scenarios are shown side-by-side in the **Auto-observed** section on the home page.

**Visual verification:**

1. Grant consent and go to the home page.
2. In the Auto-observed section, identify the three click-scenario cards (each shows a coloured
   `click` or `direct`/`descendant`/`ancestor` badge).
3. Click directly on the **direct** card — a `component_click` event appears in the sidebar.
4. Click the **Click me** button inside the **descendant** card — a `component_click` event appears.
5. Click the wrapper area around the **ancestor** card — a `component_click` event appears.

---

## 7. Consent

- On first load, no tracking events (views, clicks, hovers) are emitted.
- After the user grants consent, tracking begins immediately.
- After the user withdraws consent, tracking stops immediately.
- The current consent state is visible in the control panel at all times.
- Page events continue to fire regardless of consent state.

**Visual verification:**

1. Load the app — control panel shows **Consent: undefined**. Scroll through all entries and confirm
   no `component` events appear in the sidebar (only `page` events are present).
2. Click **Grant consent** — control panel shows **Consent: true**. Scroll over entries — view
   events start appearing.
3. Click **Withdraw consent** — control panel shows **Consent: false**. Scroll over entries — no new
   view events appear.
4. Navigate to Page Two — a `page` event appears regardless of consent state.

---

## 8. Identify and reset

- After clicking Identify, the SDK associates the session with a fixed user ID and traits.
- The control panel shows an **Identified: Yes / No** status that updates immediately.
- After clicking Reset, the session returns to anonymous and the status reverts to **No**.
- Identified and anonymous states each resolve entries to the correct variant for that profile.
- Both states persist across page reloads without the user needing to re-identify.

**Visual verification:**

1. Control panel shows **Identified: No** on fresh load.
2. Click **Identify** — status changes to **Identified: Yes** immediately.
3. With **Global live updates ON**, entry cards with active experiences switch to their variant
   (green border, `variant` badge).
4. Click **Reset** — status returns to **Identified: No** and variant cards revert to baseline.
5. Reload the page after identifying — the identified state is restored without clicking Identify
   again.

---

## 9. Live updates — global toggle

- When live updates are off (default), an entry shows the variant it first resolved to and does not
  change even if the profile changes.
- When live updates are turned on, entries re-resolve and update their displayed content immediately
  when the profile changes.

**Visual verification:**

1. The **Live updates** section on the home page shows three labelled cards. The **Default (OFF)**
   card reflects the current global state.
2. With global updates OFF, click **Identify** — the Default card does not change.
3. Click **Global: OFF** in the control panel — it toggles to **Global: ON** and the Default label
   updates to **Default (ON)**.
4. Click **Reset** — the Default card updates its content immediately.

---

## 10. Live updates — per-entry override

- An entry marked "always live" updates its content on profile changes even when the global toggle
  is off.
- An entry marked "always locked" never updates its content even when the global toggle is on.
- An entry with no override follows the global toggle.
- All three modes are shown side-by-side in the **Live updates** section on the home page.

**Visual verification:**

1. Ensure **Global live updates is OFF** in the control panel.
2. Click **Identify** — in the Live updates section, only the **Always live** card updates; the
   **Default** and **Always locked** cards stay frozen.
3. Click **Global: OFF** to turn it ON.
4. Click **Reset** — the **Default** and **Always live** cards update; the **Always locked** card
   remains frozen.

---

## 11. Preview panel forced live

- With the preview panel open, an entry marked "always locked" still updates when the panel changes
  the active audience or variant.
- Closing the preview panel returns each entry to its configured live-update behaviour.

**Visual verification:**

1. Ensure **Global live updates is OFF** in the control panel.
2. The **Always locked** card in the Live updates section should be frozen.
3. Click **Preview panel** — the Contentful panel slides in; status shows **Preview panel: Open**.
4. Click **Identify** — the Always locked card now updates its variant (it normally wouldn't).
5. Click **Preview panel** again to close it — status returns to **Closed**; the Always locked card
   goes back to ignoring profile changes.

---

## 12. Nested entries

- A parent entry and its nested child entries are all displayed.
- Each nested entry resolves to its own variant independently of the parent.
- Adding or removing nesting levels in the content model does not require code changes — the
  rendering recurses automatically.

**Visual verification:**

1. In the **Auto-observed** section on the home page, the first card renders as a tree — the
   top-level card shows a `nested` badge, and child entries are indented below it with their own
   cards.
2. Each level shows its own `base`/`var`/`exp` IDs independently.
3. Turn **Global live updates ON** and click **Identify** — each nested level independently switches
   to its own variant (different entry IDs may resolve differently).

---

## 13. Merge tags

- Rich text that contains a merge tag entry renders the personalised value at that position.
- When no personalised value is available, a visible fallback placeholder is shown instead of blank
  content.

**Visual verification:**

1. Entry cards with a rich text field that contains merge tags show a yellow `merge tag` badge.
2. On anonymous load, the inline merge tag position shows the fallback text `[Merge Tag]`.
3. Turn **Global live updates ON** and click **Identify** — the merge tag value updates to the
   resolved personalised value (e.g. a first name) inline within the rich text.
4. Click **Reset** — the value reverts to `[Merge Tag]`.

---

## 14. Rich text rendering

- All standard rich text node types (headings, paragraphs, lists, inline entries, etc.) are rendered
  correctly.
- Embedded entry nodes that are merge tags are resolved as described in feature 13.

**Visual verification:**

1. Entry cards with a rich text field show a blue `rich text` badge.
2. The card body renders the document as formatted HTML — paragraphs, headings, and lists are
   visible as styled elements, not raw JSON.
3. Merge tag nodes within the document are replaced with their resolved value (or fallback), not
   left as raw entry objects.

---

## 15. Analytics event display

- Every tracking event (page, view, click, hover) appears in the right sidebar as it occurs.
- View and hover events with the same view or hover ID show a single row that updates its duration
  rather than adding new rows for each heartbeat — the **Raw count** shows total events received
  while the list shows the deduplicated view.
- The sidebar persists across route navigation and retains its full event history.
- Flag access emits a view event automatically — this appears in the panel without any explicit emit
  in application code.

**Visual verification:**

1. Load the app — the sidebar shows a `page` event. The raw count and list count match (1).
2. Grant consent and hover over an entry — `component_hover` events appear. Hover for a few seconds
   — the duration in the existing row updates; the **Raw count** increases faster than the list
   grows.
3. Navigate to Page Two — a `page — /page-two` event appears; all previous events are still visible.
4. Click **Identify** — a `component` event for the boolean flag appears automatically in the
   sidebar.

---

## 16. Preview panel

- When the preview panel feature is enabled, the panel attaches on load and is lazy-loaded (no panel
  code is loaded when the feature is disabled).
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
- Navigating to Page Two emits a page event for that route.
- Arriving on Page Two fires a conversion event automatically (using `trackView` with component ID
  `page-two-conversion`).
- The **Track conversion** button in the control panel is active only on Page Two and fires an
  additional conversion event on demand.
- Page Two renders one auto-tracked and one manually-tracked entry.
- Navigating back and forth does not cause duplicate SDK initialisations or lost event history.

**Visual verification:**

1. Click **Page Two** in the nav — the analytics sidebar shows a `page — /page-two` event and a
   `component — page-two-conversion` event, both fired automatically on arrival.
2. The **Track conversion** button in the control panel is now enabled. Click it — a second
   `component — page-two-conversion` event appears.
3. Navigate back to **Home** — the Track conversion button is greyed out; the full event history
   from Page Two is still visible in the sidebar.

---

## 18. Locale consistency

- All Contentful entry fetches use the locale that the SDK has resolved for the current session.
- The Contentful CDA client is wrapped with the SDK's locale resolver so the two never diverge.

**Visual verification:**

Locale consistency is structural and not directly observable in the UI without a real multi-locale
Contentful space. Verify by code inspection: `contentful-client.ts` wraps the raw Contentful client
with `sdk.withOptimizationLocale()` before fetching entries.

---

## 19. Feature flags

- The app subscribes to a flag named `'boolean'` via the SDK's flag state API.
- Accessing the flag automatically emits a view event to the event stream — no explicit tracking
  call is needed.

**Visual verification:**

1. On load, the control panel shows **Flag "boolean": undefined** — anonymous sessions have no flag
   value.
2. Click **Identify** — the flag resolves to `true` and the control panel updates immediately.
3. A `component` event appears in the analytics sidebar automatically (from flag access, not any
   explicit call in the app).
4. Click **Reset** — the flag returns to `undefined`.

---

## 20. Offline queue and recovery

SDK-native — no app code needed. The SDK queues events that fail to reach the Insights API while the
network is unavailable and delivers them when connectivity is restored.
