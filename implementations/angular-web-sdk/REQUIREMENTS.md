# Angular Web SDK — Requirements

> SDK: `@contentful/optimization-web` (raw Web SDK — no Angular-specific package exists yet)
> Pattern: Angular service/directive adapter over the raw Web SDK, mirroring `web-sdk_react`

---

## Implementation progress

Legend: ⬜ Not started · 🔄 In progress · ✅ Done · ❌ Blocked

### Foundation

| #   | Feature                                                           | New deps | Status  |
| --- | ----------------------------------------------------------------- | -------- | ------- |
| —   | Config token (`CONFIG` `InjectionToken`, hardcoded mock defaults) | —        | ✅ Done |
| —   | App shell (routes, root layout, nav)                              | —        | ✅ Done |

### SDK features

| Req | Feature                                                               | New deps                                     | Status  |
| --- | --------------------------------------------------------------------- | -------------------------------------------- | ------- |
| 1   | SDK initialisation — singleton, init with config, graceful error      | `@contentful/optimization-web`               | ✅ Done |
| 2   | Page tracking — emit on every route change incl. initial load         | —                                            | ✅ Done |
| 3   | Entry resolution — resolve variant or fall back to baseline           | —                                            | ✅ Done |
| 4   | Auto-tracking — `data-ctfl-*` attributes, SDK observes DOM            | —                                            | ✅ Done |
| 5   | Manual tracking — explicit `enableElement` / `clearElement`           | —                                            | ✅ Done |
| 6   | Click scenarios — direct / descendant / ancestor                      | —                                            | ✅ Done |
| 7   | Consent — toggle UI, gate tracking events                             | —                                            | ✅ Done |
| 8   | Identify / reset — fixed user ID + traits, persist across reload      | —                                            | ✅ Done |
| 9   | Live updates — global toggle (default off)                            | —                                            | ✅ Done |
| 10  | Live updates — per-entry override (always-on / locked / default)      | —                                            | ✅ Done |
| 11  | Preview panel forced live — all entries live while panel open         | `@contentful/optimization-web-preview-panel` | ✅ Done |
| 12  | Nested entries — recursive resolution via `fields.nested`             | —                                            | ✅ Done |
| 13  | Merge tags — inline personalised values in rich text                  | —                                            | ✅ Done |
| 14  | Rich text rendering — standard nodes + embedded merge tag entries     | `@contentful/rich-text-types`                | ✅ Done |
| 15  | Analytics event display — live feed, heartbeat dedup                  | —                                            | ✅ Done |
| 16  | Preview panel — env-gated, lazy-loaded, open/close                    | `@contentful/optimization-web-preview-panel` | ✅ Done |
| 17  | Multi-route navigation — two routes, page events, manual conversion   | —                                            | ✅ Done |
| 18  | Locale consistency — CDA client wrapped with `withOptimizationLocale` | `contentful`                                 | ✅ Done |
| 19  | Feature flags — subscribe to `'boolean'` flag, auto-emits view event  | —                                            | ✅ Done |
| 20  | Offline queue / recovery                                              | SDK-native — no app code needed              | ✅ N/A  |

---

## Features and acceptance criteria

---

### 1. SDK initialisation

- On load, the app initialises the SDK with the correct client credentials and API endpoints from
  environment config.
- If initialisation fails (bad credentials, network error), the app renders content using the
  baseline entries rather than crashing.
- The SDK is initialised exactly once — reloading the page does not create a second instance.

---

### 2. Page tracking

- A page event is emitted when the app first loads.
- A page event is emitted each time the user navigates to a different route within the SPA.
- Page events are emitted regardless of whether the user has given consent.

---

### 3. Entry resolution

- When a user has no active experience, the baseline entry content is shown.
- When a user matches an experience, the resolved variant content is shown instead of the baseline.
- After `identify()` or `reset()`, entries that have live updates enabled re-resolve and update
  their displayed content without a page reload.

---

### 4. Auto-tracking

- When an entry becomes visible in the viewport, a view event is emitted automatically.
- When the user clicks an entry, a click event is emitted automatically.
- When the user hovers over an entry, a hover event is emitted automatically.
- None of the above events are emitted before the user has given consent.

---

### 5. Manual tracking

- A designated set of entries is tracked via explicit SDK calls rather than DOM attributes.
- Those entries emit view events identical to auto-tracked entries.
- Manually-tracked and auto-tracked entries coexist on the same page without interfering.

---

### 6. Click scenarios

- Clicking the entry element itself emits a `component_click` event (direct).
- Clicking a button or link inside the entry emits a `component_click` event (descendant).
- Clicking a wrapper element that contains the entry emits a `component_click` event (ancestor).
- Each scenario is wired to a specific entry ID so the three shapes are visible side-by-side.

---

### 7. Consent

- On first load, no tracking events (views, clicks, hovers) are emitted.
- After the user grants consent, tracking begins immediately.
- After the user withdraws consent, tracking stops immediately.
- The current consent state is visible in the UI at all times.
- Page events continue to fire regardless of consent state.

---

### 8. Identify and reset

- After clicking Identify, the SDK associates the session with a fixed user ID and traits.
- The UI shows an "identified" status (`Yes` / `No`) that updates immediately.
- After clicking Reset, the session returns to anonymous and the status reverts.
- Identified and anonymous states each resolve entries to the correct variant for that profile.
- Both states persist across page reloads without the user needing to re-identify.

---

### 9. Live updates — global toggle

- When live updates are off (default), an entry shows the variant it first resolved to and does not
  change even if the profile changes.
- When live updates are turned on, entries re-resolve and update their displayed content immediately
  when the profile changes (e.g. after identify or reset).

---

### 10. Live updates — per-entry override

- An entry marked "always live" updates its content on profile changes even when the global toggle
  is off.
- An entry marked "always locked" never updates its content even when the global toggle is on.
- An entry with no override follows the global toggle.
- All three modes are demonstrated side-by-side on the same page.

---

### 11. Preview panel forced live

- With the preview panel open, an entry marked "always locked" still updates when the panel changes
  the active audience or variant.
- Closing the preview panel returns each entry to its configured live-update behaviour.

**Visual verification:**

1. Ensure **Global live updates is OFF** in the control panel.
2. The **"Always locked"** card in the Live Updates section should be frozen.
3. Click **"Preview panel"** to open the panel — status shows **Open**.
4. Click **Identify** — the "Always locked" card now updates its variant (it normally wouldn't).
5. Click **"Preview panel"** again to close it — the card goes back to ignoring profile changes.

---

### 12. Nested entries

- A parent entry and its nested child entries are all displayed.
- Each nested entry resolves to its own variant independently of the parent.
- Adding or removing nesting levels in the content model does not require code changes — the
  rendering recurses automatically.

**Visual verification:** Entry `1JAU028vQ7v6nB2swl3NBo` in the Auto-observed section renders as a
tree — the top-level card shows its text with a `nested` badge, and each child is indented below
with its own card. Each level resolves its own SDK variant independently. Enable Live Updates and
click Identify to see each level switch to its variant.

---

### 13. Merge tags

- Rich text that contains a merge tag entry renders the personalised value at that position.
- When no personalised value is available, a visible fallback placeholder is shown instead of blank
  content.

**Visual verification:** Entry cards with a rich text field show a yellow `merge tag` badge. The
rendered text contains the merge tag value inline (e.g. a first name). Use Identify on the control
panel to set a user profile — the inline value updates. Reset reverts to the fallback `[Merge Tag]`
placeholder.

---

### 14. Rich text rendering

- All standard rich text node types (headings, paragraphs, lists, inline entries, etc.) are rendered
  correctly.
- Embedded entry nodes that are merge tags are resolved as described in feature 13.

**Visual verification:** Entry cards with a rich text field show a blue `rich text` badge. The card
body renders the document as formatted HTML (paragraphs, headings, lists) rather than raw JSON.
Merge tag nodes within the document are replaced with their resolved value.

---

### 15. Analytics event display

- Every tracking event (page, view, click, hover) appears in the panel as it occurs.
- View and hover events with the same ID show a single row that updates its duration rather than
  adding new rows for each heartbeat.
- The panel remains visible and retains its event history when the user navigates between routes.
- Flag access emits a view event automatically — this appears in the panel without any explicit emit
  in application code.

---

### 16. Preview panel

- When the preview panel feature is enabled (via environment variable), the panel attaches on load.
- The panel can be opened and closed without affecting the app's normal operation.
- While open, the panel drives live content updates as described in feature 11.
- When the feature is disabled, no panel code is loaded.

**Visual verification:**

1. Start the app — the control panel shows **Preview panel: Closed**.
2. Click **"Preview panel"** button — the Contentful panel slides in on the right side of the page.
3. The status row updates to **Preview panel: Open**.
4. Click the button again — the panel closes, status returns to **Closed**.
5. To disable: set `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL=false` in `.env` — no panel attaches.

---

### 17. Multi-route navigation

- The app has at least two routes, navigable via an in-app link.
- Navigating to the second route emits a page event for that route.
- The second route fires a manual conversion event automatically on arrival and exposes a button to
  fire an additional manual conversion event on demand.
- The second route also renders one auto-tracked and one manually-tracked entry.
- Navigating back and forth does not cause duplicate SDK initialisations or lost event history.

---

### 18. Locale consistency

- All Contentful entry fetches use the locale that the SDK has resolved for the current session.
- The Contentful CDA client is wrapped with the SDK's locale resolver so the two never diverge.

---

### 19. Feature flags

- The app subscribes to a flag named `'boolean'` via the SDK's flag state API.
- Accessing the flag automatically emits a view event to the event stream — no explicit tracking
  call is needed.

**Visual verification:**

1. On load the control panel shows `Flag "boolean": undefined` — anonymous sessions have no flag
   value.
2. Click **Identify** — the flag resolves to `true` and the control panel updates immediately.
3. A `component` event appears in the analytics sidebar automatically.
4. Click **Reset** — the flag returns to `undefined`.

---

### 20. Offline queue and recovery

SDK-native — no app code needed. The SDK queues events that fail to reach the Insights API while the
network is unavailable and delivers them when connectivity is restored.

---

## Environment variables

| Variable                                   | Purpose                 | Default                               |
| ------------------------------------------ | ----------------------- | ------------------------------------- |
| `PUBLIC_NINETAILED_CLIENT_ID`              | SDK client ID           | `'mock-client-id'`                    |
| `PUBLIC_NINETAILED_ENVIRONMENT`            | SDK environment         | `'main'`                              |
| `PUBLIC_INSIGHTS_API_BASE_URL`             | Insights API endpoint   | `'http://localhost:8000/insights/'`   |
| `PUBLIC_EXPERIENCE_API_BASE_URL`           | Experience API endpoint | `'http://localhost:8000/experience/'` |
| `PUBLIC_CONTENTFUL_TOKEN`                  | CDA delivery token      | `'mock-token'`                        |
| `PUBLIC_CONTENTFUL_PREVIEW_TOKEN`          | CDA preview token       | `'mock-preview-token'`                |
| `PUBLIC_CONTENTFUL_ENVIRONMENT`            | Contentful environment  | `'master'`                            |
| `PUBLIC_CONTENTFUL_SPACE_ID`               | Contentful space ID     | `'mock-space-id'`                     |
| `PUBLIC_CONTENTFUL_CDA_HOST`               | CDA host override       | `'localhost:8000'`                    |
| `PUBLIC_CONTENTFUL_BASE_PATH`              | CDA URL path prefix     | `'contentful'`                        |
| `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` | Enable preview panel    | `'true'` (default on)                 |
| `PUBLIC_OPTIMIZATION_LOG_LEVEL`            | Log level               | `'debug'`                             |
