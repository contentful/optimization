# Web SDK Reference Implementation — Requirements

Implement and validate a client-side SPA reference implementation demonstrating the full Angular
adapter SDK integration path using public APIs only, against shared mocks and fixtures. All behavior
runs entirely on the client — no SSR, no server-side rendering, no hydration.

**Constraint (REFREQ-20):** No local shims, casts, or adapter logic may mask a missing SDK
capability. All SDK interaction must go through public package APIs.

---

## Core setup

### SDK initialisation

Initialises once per page load from environment config; enforced by a module-level singleton. Falls
back to baseline rendering on init failure — no crash or blank screen. On teardown: unsubscribes the
router subscription, calls `sdk.destroy()` to flush queues and stop entry interaction tracking, and
resets the singleton so the SDK can be recreated cleanly. Confirm by loading the app — entry cards
render and control panel shows **Active optimizations: 0**; on failure, entries show baseline with
no crash. Structural: SDK created through the public Angular service; no private internals imported.
Teardown: navigate away and confirm no subscription leaks in DevTools.

### Multi-route navigation

Two routes: **Home** (`/`) and **Page Two** (`/page-two`). SDK is not re-initialised on route
changes; event history is preserved. Arriving on Page Two auto-fires
`component — page-two-conversion`; the **Track conversion** button fires an additional one. Confirm
by navigating to Page Two — sidebar shows both `page — /page-two` and
`component — page-two-conversion` automatically; navigating back and forth produces no repeated SDK
init entries.

### Consent

App exposes a consent toggle; granting enables tracking, withdrawing disables it immediately. Page
events are unaffected by consent state and always fire. Confirm with a clean session — no
`component` events appear regardless of scrolling; grant consent — view events appear on scroll;
withdraw — no new `component` events but `page` events still fire on navigation.

### Identify and reset

`identify()` associates the session with a fixed user ID; `reset()` returns to anonymous. Both
states persist across page reloads via SDK-managed storage — no app-level code required. Confirm:
clean session shows **Identified: No**; after **Identify** with live updates ON, variant cards
update; after **Reset**, cards revert to baseline; after reload, **Identified: Yes** immediately.

### Preview panel

Panel code is lazy-loaded on first open — no bundle loads when the feature is disabled (network
tab). Opening forces live re-resolution for all entries, overriding per-entry lock settings; closing
restores each entry's configured behaviour. Supports audience activation/deactivation and variant
override/reset — all handled by the panel itself; no app code required. Confirm: with global OFF and
**Always locked**, identify does not change the entry; open the panel then reset — it updates; close
and identify again — it does not change. Inside the panel: activate an audience override — entry
updates; deactivate — reverts. Apply a variant override then reset — entry returns to SDK-resolved
variant.

### Locale consistency

All CDA entry fetches use the SDK-resolved locale. Structural: Contentful client is wrapped with
`sdk.withOptimizationLocale()` before entries are fetched.

### Feature flags

App subscribes to a `'boolean'` flag via the SDK flag state API; value shown in the control panel.
Accessing the flag emits a flag-view event automatically — no explicit tracking call in app code.
Returns `undefined` for anonymous sessions; resolves to configured value after `identify()`.
Confirm: clean session shows **Flag "boolean": undefined**; after **Identify**, resolves to `true`
and a `component` event appears in the sidebar automatically; after **Reset**, returns to
`undefined`.

---

## Tracking

### Analytics

App renders the SDK event stream in real time; every tracking event (page, view, click, hover)
appears in the sidebar as it occurs. View and hover rows update in place (duration); **Raw count**
increases faster than the deduplicated list. Events blocked by consent do not appear — the SDK's
`eventStream` only emits delivered events; blocked events are routed to `blockedEventStream` and
never reach the log. History persists across route changes. Confirm: clean session — sidebar shows
`page — /`; without consent, scroll produces no `component` events; grant consent, hover an entry —
`component_hover` row appears and duration updates in place while Raw count rises; navigate routes —
prior events remain and `page` events append.

### Page tracking

A `page` event fires on first load and on every route change, regardless of consent. Confirm: clean
session — `page — /` appears immediately; navigating between routes produces a `page` event each
time, with or without consent.

### Entry tracking — attribute-based (auto)

`data-ctfl-*` attributes on DOM elements are observed by the SDK; view, click, and hover events fire
automatically after consent — none before; all stop immediately on withdrawal. Confirm: clean
session — scroll **Auto-observed**, no `component` events; grant consent, scroll — view events
appear as cards enter the viewport; click a card → `component_click`; hover → `component_hover`.

**Click scenarios** — `component_click` fires for all three: direct click on the entry, click on a
descendant button inside it, and click on an ancestor wrapper around it. Confirm by clicking the
`direct`, `descendant`, and `ancestor` cards — a `component_click` appears for each.

### Entry tracking — code-based (manual)

Entries registered via explicit `enableElement` calls instead of `data-ctfl-*` attributes emit view
events only — no click or hover events. Confirm: grant consent, scroll **Manually-observed** —
`component` view events appear; click or hover a card — no `component_click` or `component_hover`.

---

## Entry resolution

### SDK-automatic

Component wraps the baseline entry; SDK picks and renders the correct variant without any app logic;
always falls back to baseline on invalid data. Confirm: load — all cards show `baseline` badge; live
updates ON, **Identify** — active experience cards switch to `variant` with `var`/`exp` IDs;
**Reset** — cards revert to `baseline`.

### App-triggered _(TODO)_

App calls `sdk.resolveOptimizedEntry(entry)` directly; resolution triggered explicitly by app code,
not automatically by the SDK; no variant selection logic in app code. Confirm: **Manually-resolved**
section renders entries via the manual path; with live updates ON and after **Identify**,
manually-resolved entries update to their variant. Structural: resolution uses the SDK's public
resolver — no app-level resolution logic duplicated.

---

## Live updates

### Global toggle

Global toggle switches between two behaviours at runtime. **OFF (default):** entry resolves once
then freezes; `identify()`/`reset()` does not change what is displayed. **ON:** entry re-resolves
immediately on every profile change. Confirm: global OFF, **Identify** — Default card does not
change; toggle ON — Default card label updates; **Reset** — Default card updates immediately.

### Per-entry overrides

Three entries demonstrate each override mode. **Always live** — re-resolves on profile change even
when global is OFF. **Always locked** — never re-resolves regardless of global toggle; does
re-resolve when preview panel is open. **Default** — no override; follows the global toggle.
Confirm: global OFF, **Identify** — only **Always live** updates; **Default** and **Always locked**
stay frozen; toggle ON, **Reset** — **Default** and **Always live** update; **Always locked** stays
frozen.

---

## Content

### Nested entries

Each level resolves to its own variant independently; arbitrary nesting depth is handled by the SDK
without app-level recursion. Confirm: first Auto-observed card shows `nested` badge with indented
child entries, each with their own ID rows; live updates ON, **Identify** — each nested level
updates independently.

### Merge tags

Profile-resolved values rendered inline; shows `[Merge Tag]` fallback when no profile is active;
updates on `identify()` and reverts on `reset()`. Confirm: clean session — merge tag cards (yellow
badge) show `[Merge Tag]`; live updates ON, **Identify** — replaced with resolved value; **Reset** —
reverts to `[Merge Tag]`.

### Rich text

Renders as formatted HTML (paragraphs, headings, lists, blockquotes, hyperlinks). Merge tag nodes
embedded in rich text are resolved inline with the same fallback behaviour. Confirm: rich text cards
(blue badge) render formatted HTML — not raw JSON; merge tag nodes show resolved value or
`[Merge Tag]` fallback inline.
