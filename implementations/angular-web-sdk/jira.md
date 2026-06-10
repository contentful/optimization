# [NT-3235] Angular Web SDK — Reference Implementation

## Summary

Implement and validate a client-side SPA reference implementation demonstrating the full Angular
adapter SDK integration path using public APIs only, against shared mocks and fixtures. All behavior
runs entirely on the client — no SSR, no server-side rendering, no hydration.

**Constraint:** No local shims, casts, or adapter logic may mask a missing SDK capability
(REFREQ-20).

---

## Acceptance criteria

### Core setup

- [ ] **SDK initialisation** — initialises once; falls back to baseline on failure; service cleans
      up subscriptions on destroy.
- [ ] **Multi-route navigation** — two routes:
  - **Home** — main page with all entry sections and controls.
  - **Page Two** — button that fires a custom conversion event when clicked.
  - A `page` event fires on every SPA route change.
  - SDK not re-initialised on route changes; event history preserved.
- [ ] **Consent** — the app exposes a consent toggle; granting consent enables tracking, withdrawing
      disables it; page events are unaffected by consent state and always fire.
- [ ] **Identify and reset** — `identify()` and `reset()` transition profile state; both persist
      across reloads via SDK storage.
- [ ] **Preview panel** — lazy-loaded; forces live re-resolution while open; supports audience and
      variant overrides; restores locked behaviour on close.
- [ ] **Locale consistency** — Contentful client wrapped with `sdk.withOptimizationLocale()` before
      every fetch.
- [ ] **Feature flags** — SDK exposes a flag state API; app subscribes to a `'boolean'` flag and
      displays its current value:
  - Subscribing automatically emits a flag-view event — no explicit tracking call needed.
  - Returns `undefined` for anonymous sessions; resolves to the configured value after `identify()`.

### Tracking

- [ ] **Analytics** — app visually demonstrates the SDK event stream subscription by rendering
      emitted events in real time; view/hover rows update in place; events blocked by consent are
      absent; history persists across routes.
- [ ] **Page tracking** — `page` event fires on first load and every route change, regardless of
      consent.
- [ ] **Entry tracking** _(which events are emitted)_
  - **Attribute-based (auto)** — `data-ctfl-*` attributes on DOM elements are observed by the SDK;
    view, click, and hover events fire automatically after consent; none before; all stop
    immediately if consent is withdrawn.
    - **Click scenarios** — all three must emit `component_click`:
      - **Direct** — the tracked element itself is clicked.
      - **Descendant** — a button inside the tracked element is clicked.
      - **Ancestor** — click listener is on a wrapper element containing the tracked entry.
  - **Code-based (manual)** — entries registered via explicit `enableElement` calls instead of
    `data-ctfl-*` attributes; emits view events only; no click or hover events.

### Entry resolution _(which variant is displayed)_

- [ ] **SDK-automatic** — component wraps the baseline entry; the SDK picks and renders the correct
      variant without any app logic; always falls back to baseline on invalid data.
- [ ] **App-triggered** — app calls `sdk.resolveOptimizedEntry(entry)` directly and decides when and
      how to render the result; useful when the resolved value is needed in app logic, not just in a
      template; no variant selection logic in app code.

### Live updates

- [ ] **Global toggle** — control switches between two behaviours at runtime:
  - **OFF (default):** entry resolves once then freezes; `identify()`/`reset()` does not change what
    is displayed.
  - **ON:** entry re-resolves immediately on every profile change.
- [ ] **Per-entry** — three entries shown with different override modes:
  - **Always live** — always re-resolves even when global toggle is OFF.
  - **Always locked** — never re-resolves regardless of global toggle; does re-resolve when preview
    panel is open.
  - **Default** — no override; follows the global toggle.

### Content

- [ ] **Nested entries** — each level resolves independently; arbitrary nesting depth is handled by
      the SDK without app-level recursion.
- [ ] **Merge tags** — renders merge tags with profile-resolved values inline; shows `[Merge Tag]`
      fallback when no profile is active.
- [ ] **Rich text rendering** — renders as formatted HTML; merge tag entries embedded inside rich
      text are replaced with their profile-resolved value or `[Merge Tag]` fallback inline.

---

## References

- [Framework adapter SDK requirements](https://contentful.github.io/optimization/documents/Documentation.Product_documentation.Framework_adapter_SDK_requirements.html)
- [Framework and meta-framework reference implementation requirements](https://contentful.github.io/optimization/documents/Documentation.Product_documentation.Framework_and_meta-framework_reference_implementation_requirements.html)
