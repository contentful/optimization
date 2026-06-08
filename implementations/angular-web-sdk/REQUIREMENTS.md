# Angular Web SDK — Requirements

> SDK: `@contentful/optimization-web` (raw Web SDK — no Angular-specific package exists yet)
> Pattern: Angular service/directive adapter over the raw Web SDK, mirroring `web-sdk_react`

---

## Features and acceptance criteria

Each feature is described as observable behaviour. A feature is done when all of its acceptance
criteria pass against a running instance of the app connected to the local mock server.

---

### 1. SDK initialisation

The app connects to the Optimization SDK on startup and is ready to resolve personalised content
before the first user interaction.

- On load, the app initialises the SDK with the correct client credentials and API endpoints from
  environment config.
- If initialisation fails (bad credentials, network error), the app renders content using the
  baseline entries rather than crashing.
- The SDK is initialised exactly once — reloading the page does not create a second instance.

---

### 2. Page tracking

The SDK knows which page the user is on at all times.

- A page event is emitted when the app first loads.
- A page event is emitted each time the user navigates to a different route within the SPA.
- Page events are emitted regardless of whether the user has given consent.

---

### 3. Entry resolution

The app displays the correct variant of a Contentful entry for the current user profile.

- When a user has no active experience, the baseline entry content is shown.
- When a user matches an experience, the resolved variant content is shown instead of the baseline.
- After `identify()` or `reset()`, entries that have live updates enabled re-resolve and update
  their displayed content without a page reload.

---

### 4. Auto-tracking

The SDK tracks user interactions with personalised content automatically, without the app needing to
write explicit event code for each element.

- When an entry becomes visible in the viewport, a view event is emitted automatically.
- When the user clicks an entry, a click event is emitted automatically.
- When the user hovers over an entry, a hover event is emitted automatically.
- None of the above events are emitted before the user has given consent.

---

### 5. Manual tracking

The app demonstrates that entry tracking can also be wired up explicitly in code, for cases where
the automatic attribute-based approach is not suitable.

- A designated set of entries is tracked via explicit SDK calls rather than DOM attributes.
- Those entries emit view events identical to auto-tracked entries.
- Manually-tracked and auto-tracked entries coexist on the same page without interfering.

---

### 6. Click scenarios

The app demonstrates that click tracking works regardless of where in the DOM hierarchy the
clickable element lives relative to the entry element.

- Clicking the entry element itself emits a `component_click` event (direct).
- Clicking a button or link inside the entry emits a `component_click` event (descendant).
- Clicking a wrapper element that contains the entry emits a `component_click` event (ancestor).
- Each scenario is wired to a specific entry ID so the three shapes are visible side-by-side.

---

### 7. Consent

The user controls whether the app is allowed to track their interactions.

- On first load, no tracking events (views, clicks, hovers) are emitted.
- After the user grants consent, tracking begins immediately.
- After the user withdraws consent, tracking stops immediately.
- The current consent state is visible in the UI at all times.
- Page events continue to fire regardless of consent state.

---

### 8. Identify and reset

The app can associate the current session with a known user identity, and undo that association.

- After clicking Identify, the SDK associates the session with a fixed user ID and traits.
- The UI shows an "identified" status (`Yes` / `No`) that updates immediately.
- After clicking Reset, the session returns to anonymous and the status reverts.
- Identified and anonymous states each resolve entries to the correct variant for that profile.
- Both states persist across page reloads without the user needing to re-identify.

---

### 9. Live updates — global toggle

The app provides a switch that controls whether personalised content updates dynamically as the
user's profile changes.

- When live updates are off (default), an entry shows the variant it first resolved to and does not
  change even if the profile changes.
- When live updates are turned on, entries re-resolve and update their displayed content immediately
  when the profile changes (e.g. after identify or reset).

---

### 10. Live updates — per-entry override

Individual entries can opt out of or into live updates independently of the global toggle.

- An entry marked "always live" updates its content on profile changes even when the global toggle
  is off.
- An entry marked "always locked" never updates its content even when the global toggle is on.
- An entry with no override follows the global toggle.
- All three modes are demonstrated side-by-side on the same page.

---

### 11. Preview panel forced live

When the Contentful preview panel is open, all entries behave as if live updates are on, regardless
of their individual setting.

- With the preview panel open, an entry marked "always locked" still updates when the panel changes
  the active audience or variant.
- Closing the preview panel returns each entry to its configured live-update behaviour.

---

### 12. Nested entries

The app resolves and displays a content tree where entries contain other entries, each personalised
independently.

- A parent entry and its nested child entries are all displayed.
- Each nested entry resolves to its own variant independently of the parent.
- Adding or removing nesting levels in the content model does not require code changes — the
  rendering recurses automatically.

---

### 13. Merge tags

The app injects personalised values inline into rich text content.

- Rich text that contains a merge tag entry renders the personalised value at that position.
- When no personalised value is available, a visible fallback placeholder is shown instead of blank
  content.

---

### 14. Rich text rendering

The app renders Contentful rich text documents including embedded entries.

- All standard rich text node types (headings, paragraphs, lists, inline entries, etc.) are rendered
  correctly.
- Embedded entry nodes that are merge tags are resolved as described in feature 13.

---

### 15. Analytics event display

The app shows a live feed of all SDK events so developers can verify tracking behaviour without
opening a network inspector.

- Every tracking event (page, view, click, hover) appears in the panel as it occurs.
- View and hover events with the same ID show a single row that updates its duration rather than
  adding new rows for each heartbeat.
- The panel remains visible and retains its event history when the user navigates between routes.
- Flag access emits a view event automatically — this appears in the panel without any explicit emit
  in application code.

---

### 16. Preview panel

Contentful editors can open an in-app panel to inspect and override active audiences and variants.

- When the preview panel feature is enabled (via environment variable), the panel attaches on load.
- The panel can be opened and closed without affecting the app's normal operation.
- While open, the panel drives live content updates as described in feature 11.
- When the feature is disabled, no panel code is loaded.

---

### 17. Multi-route navigation

The app demonstrates that SDK tracking works correctly across client-side navigation.

- The app has at least two routes, navigable via an in-app link.
- Navigating to the second route emits a page event for that route.
- The second route fires a manual conversion event automatically on arrival and exposes a button to
  fire an additional manual conversion event on demand.
- The second route also renders one auto-tracked and one manually-tracked entry.
- The second route displays the current consent and identified state.
- Navigating back and forth does not cause duplicate SDK initialisations or lost event history.

---

### 18. Locale consistency

The app and the SDK always use the same locale when fetching and resolving content.

- All Contentful entry fetches use the locale that the SDK has resolved for the current session.
- The Contentful CDA client is wrapped with the SDK's locale resolver so the two never diverge.

---

### 19. Feature flags

The app demonstrates that the SDK can resolve boolean feature flags and that flag access is
automatically tracked.

- The app subscribes to a flag named `'boolean'` via the SDK's flag state API.
- Accessing the flag automatically emits a view event to the event stream — no explicit tracking
  call is needed.
- The flag event appears in the analytics event display panel.

---

### 20. Offline queue and recovery

The SDK queues events that fail to reach the Insights API while the network is unavailable and
delivers them when connectivity is restored.

- Tracking events (views, clicks) emitted while offline are not lost.
- When the network is restored, queued events are flushed to the Insights API automatically.
- An identify call made while offline takes effect once connectivity is restored, and the user
  profile updates to reflect the identified state.

---

### 22. Environment configuration

The app runs against the local mock server out of the box with no manual credential setup.

- Copying `.env.example` to `.env` and starting the app is sufficient to see personalised content
  from the mock server.
- No real Contentful space ID, token, or SDK credentials are required for local development.
- All configurable values (API URLs, credentials, feature flags) are controlled via environment
  variables with no hardcoded values in source files.

---

## Implementation progress

Legend: ⬜ Not started · 🔄 In progress · ✅ Done · ❌ Blocked

### Foundation

| #   | Feature                                                           | New deps | Status  |
| --- | ----------------------------------------------------------------- | -------- | ------- |
| —   | Config token (`CONFIG` `InjectionToken`, hardcoded mock defaults) | —        | ✅ Done |
| —   | App shell (routes, root layout, nav)                              | —        | ✅ Done |

### SDK features

| Req | Feature                                                               | New deps                                                              | Status         |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------- |
| 1   | SDK initialisation — singleton, init with config, graceful error      | `@contentful/optimization-web`                                        | ✅ Done        |
| 2   | Page tracking — emit on every route change incl. initial load         | —                                                                     | ✅ Done        |
| 18  | Locale consistency — CDA client wrapped with `withOptimizationLocale` | `contentful`                                                          | ⬜ Not started |
| 3   | Entry resolution — resolve variant or fall back to baseline           | —                                                                     | ⬜ Not started |
| 4   | Auto-tracking — `data-ctfl-*` attributes, SDK observes DOM            | —                                                                     | ⬜ Not started |
| 5   | Manual tracking — explicit `enableElement` / `clearElement`           | —                                                                     | ⬜ Not started |
| 6   | Click scenarios — direct / descendant / ancestor                      | —                                                                     | ⬜ Not started |
| 7   | Consent — toggle UI, gate tracking events                             | —                                                                     | ⬜ Not started |
| 8   | Identify / reset — fixed user ID + traits, persist across reload      | —                                                                     | ⬜ Not started |
| 9   | Live updates — global toggle (default off)                            | —                                                                     | ⬜ Not started |
| 10  | Live updates — per-entry override (always-on / locked / default)      | —                                                                     | ⬜ Not started |
| 11  | Preview panel forced live — all entries live while panel open         | `@contentful/optimization-web-preview-panel`                          | ⬜ Not started |
| 12  | Nested entries — recursive resolution via `fields.nested`             | —                                                                     | ⬜ Not started |
| 13  | Merge tags — inline personalised values in rich text                  | —                                                                     | ⬜ Not started |
| 14  | Rich text rendering — standard nodes + embedded merge tag entries     | `@contentful/rich-text-html-renderer` · `@contentful/rich-text-types` | ⬜ Not started |
| 15  | Analytics event display — live feed, heartbeat dedup                  | —                                                                     | ⬜ Not started |
| 16  | Preview panel — env-gated, lazy-loaded, open/close                    | —                                                                     | ⬜ Not started |
| 17  | Multi-route navigation — two routes, page events, manual conversion   | —                                                                     | ⬜ Not started |
| 19  | Feature flags — subscribe to `'boolean'` flag, auto-emits view event  | —                                                                     | ⬜ Not started |
| 20  | Offline queue / recovery                                              | SDK-native — no app code needed                                       | ✅ N/A         |

---

## Current scaffold state

The following files already exist from the initial scaffold commit and must not be recreated from
scratch — only extended:

| File                    | Current state                                                            |
| ----------------------- | ------------------------------------------------------------------------ |
| `src/main.ts`           | Bootstraps Angular with `app.config.ts`                                  |
| `src/index.html`        | HTML shell with `<app-root>`                                             |
| `src/styles.css`        | Minimal global reset                                                     |
| `src/app/app.ts`        | Root component rendering Hello World                                     |
| `src/app/app.config.ts` | `provideZonelessChangeDetection()`, `provideRouter([])`                  |
| `src/app/app.routes.ts` | Empty routes array                                                       |
| `angular.json`          | Angular CLI config, dev server on port 3000                              |
| `tsconfig.json`         | Strict TypeScript, no test split yet                                     |
| `package.json`          | Angular 22 deps only — SDK packages not yet installed                    |
| `pnpm-workspace.yaml`   | Isolates impl from root lockfile, overrides SDK deps to `pkgs/` tarballs |
| `.env.example`          | Only has 4 vars — must be extended to the full list in this document     |
| `AGENTS.md`             | Local rules for this implementation                                      |

---

## Required npm packages

These packages are not yet in `package.json` and must be added before writing any SDK code. Install
via `pnpm install` within the implementation directory after adding them.

**Dependencies:**

| Package                        | Source                                           |
| ------------------------------ | ------------------------------------------------ |
| `@contentful/optimization-web` | local tarball via `pnpm-workspace.yaml` override |
| `contentful`                   | npm                                              |

**Dev / optional dependencies:**

| Package                                      | Source                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `@contentful/optimization-web-preview-panel` | local tarball via `pnpm-workspace.yaml` override (lazy-loaded at runtime) |

The `pnpm-workspace.yaml` already overrides `@contentful/*` packages to point at `pkgs/` tarballs.
Run `pnpm build:pkgs` from the repo root before installing to ensure the tarballs exist.

---

## Angular version and change detection

This implementation uses **Angular 22** with **zoneless change detection**
(`provideZonelessChangeDetection()` is already in `app.config.ts`). `zone.js` is not present.

Consequences for implementation:

- Do not use `ChangeDetectorRef.markForCheck()` — use Angular signals (`signal()`, `computed()`) or
  the `async` pipe with `AsyncPipe` for template bindings
- RxJS observables from SDK state subscriptions should be bridged to signals via `toSignal()` where
  used in templates, or consumed with `async` pipe
- Service state that drives template updates must be a signal or an Observable piped through `async`

---

## Environment variable injection

Angular CLI (`@angular/build:application`, esbuild-based) does not support `import.meta.env` by
default. Env vars must be injected at build time via the `define` option in `angular.json`.

Add a `define` block to the `build.options` section of `angular.json`:

```json
"define": {
  "process.env.PUBLIC_NINETAILED_CLIENT_ID": "JSON.stringify(process.env.PUBLIC_NINETAILED_CLIENT_ID ?? '')",
  ...
}
```

Then read them in `src/app/config/environment.ts` via `process.env.PUBLIC_*`. The Angular CLI
esbuild runner replaces these at bundle time, so they are baked into the output.

Alternatively, use `@angular/build`'s built-in `fileReplacements` with `environment.ts` /
`environment.prod.ts` files — but the `define` approach is simpler for `.env`-driven config.

The `.env` file is loaded into the build process via the `dotenv` CLI or a Node script; check how
sibling implementations do it (e.g., `web-sdk_react` uses Rsbuild which reads `.env` natively).
Adapt as needed for Angular CLI.

---

## Actual entry IDs

Use these exact IDs — they match the shared mock server fixture data used by all sibling
implementations. Copy them verbatim into `src/app/config/entries.ts`.

```typescript
export const AUTO_OBSERVED_ENTRY_IDS = [
  '1JAU028vQ7v6nB2swl3NBo',
  '1MwiFl4z7gkwqGYdvCmr8c',
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
] as const

export const MANUALLY_OBSERVED_ENTRY_IDS = [
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
] as const

export const ENTRY_IDS = [...AUTO_OBSERVED_ENTRY_IDS, ...MANUALLY_OBSERVED_ENTRY_IDS] as const

export const LIVE_UPDATES_ENTRY_ID = '2Z2WLOx07InSewC3LUB3eX' as const
export const PAGE_TWO_AUTO_ENTRY_ID = '2Z2WLOx07InSewC3LUB3eX' as const
export const PAGE_TWO_MANUAL_ENTRY_ID = '5XHssysWUDECHzKLzoIsg1' as const
```

---

## SDK adapter layer

No `@contentful/optimization-angular` package exists. The implementation must build a thin Angular
adapter, equivalent to `web-sdk_react/src/optimization/`. The adapter isolates all SDK concerns from
the rest of the application.

Required files:

```
src/app/optimization/
  optimization.service.ts           # SDK singleton, init, page tracking, consent/identify/reset, preview panel
  optimization-resolver.service.ts  # entry resolution + merge tag value extraction
  live-updates.service.ts           # global live-updates signal + per-component mode logic
  merge-tag.pipe.ts                 # pipe wrapping getMergeTagValue() for template use
```

### Singleton

The SDK must be created once per application. Use a module-level variable (not `providedIn: 'root'`
injection) to hold the singleton so Angular StrictMode double-construction is not an issue — same
approach as `web-sdk_react/src/optimization/createOptimization.ts`.

---

## SDK initialisation

Constructor options that must be passed (all sourced from `environment.ts`):

| Option                      | Type                        | Source                                                                                    |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| `clientId`                  | string                      | `PUBLIC_NINETAILED_CLIENT_ID`                                                             |
| `environment`               | string                      | `PUBLIC_NINETAILED_ENVIRONMENT`                                                           |
| `api.insightsBaseUrl`       | string                      | `PUBLIC_INSIGHTS_API_BASE_URL`                                                            |
| `api.experienceBaseUrl`     | string                      | `PUBLIC_EXPERIENCE_API_BASE_URL`                                                          |
| `locale`                    | string                      | `'en-US'` constant                                                                        |
| `contentfulLocales.default` | string                      | `'en-US'` constant                                                                        |
| `autoTrackEntryInteraction` | `{ views, clicks, hovers }` | all `true`                                                                                |
| `logLevel`                  | `'debug'│'warn'│'error'`    | resolved from `PUBLIC_OPTIMIZATION_LOG_LEVEL`; default `'debug'` in dev, `'warn'` in prod |
| `app.name`                  | string                      | implementation name constant                                                              |
| `app.version`               | string                      | `'0.0.0'`                                                                                 |

Init must be wrapped in try/catch. Errors must be stored on the service (not thrown) so components
degrade gracefully — same pattern as `OptimizationProvider.tsx` in `web-sdk_react`.

---

## Page tracking

Subscribe to `Router` events and call `sdk.page()` on every `NavigationEnd`. This is the Angular
equivalent of `ReactRouterAutoPageTracker` and `NextAppAutoPageTracker`. Page events must fire for
every route change including the initial load.

---

## State subscriptions

The service must expose Angular-friendly observables (RxJS `BehaviorSubject` or `Observable`) for
every SDK state used in the app. Raw SDK observables must be bridged and unsubscribed in
`ngOnDestroy`. States to expose:

| SDK state                          | Exposed as                                                      | Used by                        |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `sdk.states.consent`               | `consent$: Observable<boolean│undefined>`                       | utility panel, tracking gate   |
| `sdk.states.profile`               | `profile$: Observable<Profile│undefined>`                       | identify/reset button state    |
| `sdk.states.selectedOptimizations` | `selectedOptimizations$: Observable<SelectedOptimizationArray>` | entry re-resolution trigger    |
| `sdk.states.eventStream`           | `eventStream$: Observable<Event>`                               | analytics event display        |
| `sdk.states.flag('boolean')`       | method `flag$(name): Observable<unknown>`                       | feature flags (see feature 19) |

---

## Entry resolution

`OptimizationResolverService` must wrap `sdk.resolveOptimizedEntry(entry)` and return both the
resolved entry and the `selectedOptimization` metadata object:

```typescript
resolveEntry(baseline: Entry): {
  entry: Entry
  selectedOptimization: {
    experienceId: string
    sticky: boolean
    variantIndex: number
  } | undefined
}
```

Fallback when SDK is not ready: return the baseline entry unchanged (same as
`useOptimizationResolver` fallback in `web-sdk_react`).

`OptimizedEntryComponent` wraps the resolver and renders `data-ctfl-*` attributes on its host
element automatically. Required attributes:

| Attribute                                     | Value                                                      |
| --------------------------------------------- | ---------------------------------------------------------- |
| `data-ctfl-entry-id`                          | resolved entry `sys.id`                                    |
| `data-ctfl-baseline-id`                       | baseline entry `sys.id`                                    |
| `data-ctfl-optimization-id`                   | `selectedOptimization.experienceId` (if present)           |
| `data-ctfl-sticky`                            | `selectedOptimization.sticky` as string (if present)       |
| `data-ctfl-variant-index`                     | `selectedOptimization.variantIndex` as string (if present) |
| `data-ctfl-hover-duration-update-interval-ms` | `'1000'`                                                   |

---

## Auto-tracking vs manual tracking

Two observation modes must be demonstrated, matching `react-web-sdk` and `web-sdk_react`:

**Auto-tracked entries** — rendered with `data-ctfl-entry-id` and sibling attributes. The SDK's
MutationObserver discovers them automatically.
`autoTrackEntryInteraction: { views, clicks, hovers }` must all be `true`.

**Manually-tracked entries** — rendered without `data-ctfl-entry-id`. The component calls
`sdk.tracking.enableElement('views', element, { data: { entryId, optimizationId, sticky, variantIndex } })`
in `ngAfterViewInit` and `sdk.tracking.clearElement('views', element)` in `ngOnDestroy`. Manual
tracking via `enableElement` supports only `'views'` — clicks and hovers are auto-only.

The `ContentEntryComponent` must support both modes via an `observation` input
(`'auto' | 'manual'`).

---

## Click scenarios

Three click scenario variants must be demonstrated (verified by E2E in sibling implementations):

| Scenario   | Entry ID                 | Shape                                                               |
| ---------- | ------------------------ | ------------------------------------------------------------------- |
| Direct     | `4ib0hsHWoSOnCVdDkizE8d` | `data-ctfl-clickable="true"` on the entry element itself            |
| Descendant | `xFwgG3oNaOcjzWiGe4vXo`  | `data-ctfl-clickable="true"` on a child button or link              |
| Ancestor   | `2Z2WLOx07InSewC3LUB3eX` | `data-ctfl-clickable="true"` on a wrapper div enclosing the content |

All three must emit `component_click` events. The scenario is passed as an input to
`ContentEntryComponent` alongside the entry, keyed by entry ID.

---

## Consent

- UI: toggle button showing current consent state (`true / false / undefined`)
- API: `sdk.consent(boolean)` — called directly from the service wrapper
- Gate: view/click/hover events are blocked by the SDK until `consent === true`; page events are
  allowed before consent — this is SDK behaviour, not something the app enforces

---

## Identify / reset

- UI: identify button calls `sdk.identify({ userId: 'charles', traits: { identified: true } })`
- UI: reset button calls `sdk.reset()` followed immediately by `sdk.page()` (reset does not
  auto-emit a page event)
- Both must update `profile$` observable, reflecting `profile.traits.identified`
- State persists across page reloads (SDK handles storage)

---

## Live updates

### Global toggle

`LiveUpdatesService` holds a `BehaviorSubject<boolean>` `globalLiveUpdates$` (default `false`). The
utility panel on the home page exposes a toggle button. The value is passed to every
`OptimizedEntryComponent` that uses the default live-update mode.

### Per-entry modes

`OptimizedEntryComponent` accepts a `liveUpdates` input with three states:

| Value                 | Behaviour                                             |
| --------------------- | ----------------------------------------------------- |
| `undefined` (default) | inherits global toggle                                |
| `true`                | always live regardless of global                      |
| `false`               | locked to first resolved variant regardless of global |

When `liveUpdates` resolves to `true`, the component re-resolves the entry whenever
`selectedOptimizations$` emits. When `false`, it locks to the first resolved result.

### Preview panel override

When the preview panel is visible (`previewPanelOpen && previewPanelAttached`), all entries must act
as live regardless of their `liveUpdates` input — confirmed behaviour across React, React Native,
and Node+Web SDK implementations.

---

## Nested entries

`NestedContentEntryComponent` fetches the entry's `fields.nested` array, filters with an `isEntry()`
type guard (validates `sys.id` is string and `fields` is object), and renders each child via a
recursive `NestedContentItemComponent` that itself contains `OptimizedEntryComponent`.

CDA `include` depth must be set to `10` (consistent across all sibling implementations). Recursion
stops naturally when `fields.nested` is absent or empty.

---

## Merge tags

`MergeTagPipe` wraps `sdk.getMergeTagValue(mergeTagEntry)`. Must handle `undefined` / `null` /
non-string values by converting them to strings safely (same `toStringValue()` logic as
`web-sdk_react/src/optimization/hooks/useOptimizationResolver.ts` lines 25–43).

`RichTextRendererComponent` renders Contentful rich text and injects merge tag values for
`INLINES.EMBEDDED_ENTRY` nodes. Fallback text for unresolvable merge tags: `'[Merge Tag]'`.

---

## Analytics event display

`AnalyticsEventDisplayComponent` subscribes to `eventStream$` and renders all events. Required
behaviours:

- **Heartbeat deduplication** — view events (`type === 'component'` with `viewId`) and hover events
  (`type === 'component_hover'` with `hoverId`) are upserted by their ID (duration updated in place,
  not appended as new rows)
- **Non-heartbeat events** are prepended (newest first)
- **Event types** to handle: `'page'`, `'component'`, `'component_click'`, `'component_hover'`
- Component must remain mounted across route changes (declared in root component, not in a page)

---

## Preview panel

- Env-gated: only attach when `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'`
- Lazy-load `@contentful/optimization-web-preview-panel` via dynamic `import()`
- Call `attachOptimizationPreviewPanel({ contentful: getContentfulClient() })` after SDK is ready
- Guard against double-attachment with a module-level `attachmentStarted` flag
- `LiveUpdatesService` must expose `previewPanelVisible$: Observable<boolean>` derived from
  `sdk.states.previewPanelAttached` AND `sdk.states.previewPanelOpen`

---

## Routes

| Path        | Component          | Notes                                                                                 |
| ----------- | ------------------ | ------------------------------------------------------------------------------------- |
| `/`         | `HomeComponent`    | utility panel, auto-observed entries, manually-observed entries, live updates section |
| `/page-two` | `PageTwoComponent` | nav demo, manual conversion tracking via `sdk.trackView()`                            |

`PageTwoComponent` calls
`sdk.trackView({ componentId: '...', viewId: crypto.randomUUID(), viewDurationMs: 0 })` on mount to
demonstrate manual conversion tracking.

---

## Home page layout

The home page must show a loading state (`data-testid="home-loading"`) until entries have been
fetched and at least one selected optimization is available or entries are loaded. This matches the
`isOptimizationReady` guard in `react-web-sdk/src/pages/HomePage.tsx`.

Utility panel must include:

- Consent toggle button (shows current consent state: `true / false / undefined`)
- Identify button
- Reset button
- Global live-updates toggle button (`Global: ON / OFF`)
- Status line: selected optimizations count
- Status line: identified state (`Yes / No`)
- Status line: global live-updates state (`ON / OFF`)
- Status line: preview panel state (`Open / Closed`)

Entry sections:

1. Auto-observed entries (from `AUTO_OBSERVED_ENTRY_IDS`, min 5) — each rendered with its click
   scenario input keyed from the mapping in the Click scenarios section above
2. Manually-observed entries (from `MANUALLY_OBSERVED_ENTRY_IDS`, min 3)
3. Live updates example section (same entry rendered three times: default / always-on / locked)

`AnalyticsEventDisplayComponent` lives in the root layout (persistent across route changes).

---

## Entry config

`src/app/config/entries.ts` must define:

```typescript
export const AUTO_OBSERVED_ENTRY_IDS: string[] // min 5, includes nested entry ID
export const MANUALLY_OBSERVED_ENTRY_IDS: string[] // min 3
export const LIVE_UPDATES_ENTRY_ID: string
export const PAGE_TWO_AUTO_ENTRY_ID: string
export const PAGE_TWO_MANUAL_ENTRY_ID: string
```

Entry IDs must match the mock server fixture data (same IDs used across sibling implementations).

---

## Contentful CDA client

`src/app/services/contentful-client.ts` must:

- Create a single `contentful.createClient(...)` instance with config from `environment.ts`
- Set `insecure: true` when host contains `'localhost'`
- Set `include: 10` on all `getEntry` / `getEntries` calls
- Export `getContentfulClient(sdk?: OptimizationInstance)` that returns the client wrapped with
  `sdk.withOptimizationLocale()` when an SDK instance is provided

---

## Environment variables

All variables read through `src/app/config/environment.ts`. The `.env.example` must include all of
the following:

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
| `PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL` | Enable preview panel    | `'true'`                              |
| `PUBLIC_OPTIMIZATION_LOG_LEVEL`            | Log level               | `'debug'`                             |

---

## Proposed file structure

```
src/
  main.ts
  app/
    app.ts                    # root component — layout shell + analytics display (persistent)
    app.config.ts             # providers
    app.routes.ts             # / and /page-two

    optimization/
      optimization.service.ts
      optimization-resolver.service.ts
      live-updates.service.ts
      merge-tag.pipe.ts

    pages/
      home/home.component.ts
      page-two/page-two.component.ts

    sections/
      content-entry/content-entry.component.ts
      live-updates-entry/live-updates-entry.component.ts
      nested-content-entry/nested-content-entry.component.ts
      nested-content-item/nested-content-item.component.ts

    components/
      optimized-entry/optimized-entry.component.ts
      analytics-event-display/analytics-event-display.component.ts
      rich-text-renderer/rich-text-renderer.component.ts

    config/
      entries.ts
      routes.ts
      environment.ts

    services/
      contentful-client.ts
```

---

## Implementation order

1. `environment.ts` + `.env.example` — wire all env vars
2. `contentful-client.ts` — CDA factory + `withOptimizationLocale`
3. `optimization.service.ts` — SDK singleton, init, page tracking, consent/identify/reset
4. `optimization-resolver.service.ts` — entry resolution, merge tag value
5. `live-updates.service.ts` — global signal, preview panel state
6. `optimized-entry.component.ts` — data-ctfl-\* attributes, auto/manual tracking modes
7. `app.routes.ts` + `pages/` — route shell + utility panel
8. `content-entry.component.ts` — auto + manual + click scenarios
9. `live-updates-entry.component.ts` — three live-update modes
10. `nested-content-entry.component.ts` + `nested-content-item.component.ts`
11. `merge-tag.pipe.ts` + `rich-text-renderer.component.ts`
12. `analytics-event-display.component.ts`
13. `page-two.component.ts` — nav + manual `trackView()` conversion
14. Preview panel attach in `optimization.service.ts`

---

## Remarks from sibling analysis

- **Module-level singleton** — `providedIn: 'root'` risks double-instantiation in some edge cases;
  use a module-level variable as `web-sdk_react` does.
- **`sdk.reset()` does not auto-emit a page event** — must call `sdk.page()` immediately after.
- **Heartbeat deduplication is required** for the analytics display to be usable — without it the
  panel floods with repeated duration-update rows.
- **Preview panel double-attach guard** (`attachmentStarted` flag) is essential — Angular change
  detection can trigger the ready callback multiple times.
- **`data-ctfl-baseline-id`** is required alongside `data-ctfl-entry-id` to prevent variant churn on
  re-render — without it the SDK may attempt to re-resolve an already-resolved variant entry.
- **`isEntry()` type guard** is required before recursing into `fields.nested` — the CDA response
  may include unresolved link stubs (objects without `fields`) at shallow include depths.
- **`withOptimizationLocale()`** must wrap the CDA client for every entry fetch — without it the SDK
  and the CDA use different locale contexts and personalization breaks.
- **`sdk.states.flag()` subscription** automatically emits a `component` event to the event stream
  on access — no explicit emit needed.
- **Consent blocks entry-level events** (views, clicks, hovers) but **not page events** — the app
  must not try to gate page tracking itself.
- **Manual tracking cleanup** (`clearElement`) must happen in `ngOnDestroy` — failing to clear leads
  to stale element references and duplicate events after re-render.
- **Live-updates forced live on preview panel open** is confirmed across React, React Native, and
  Node+Web SDK — it is expected SDK behaviour.
- **Include depth 10** is consistent across all sibling implementations — do not reduce it.
- **`crypto.randomUUID()`** is used for `viewId` in manual `trackView()` calls — available in all
  modern browsers and in the Angular CLI dev server context.
