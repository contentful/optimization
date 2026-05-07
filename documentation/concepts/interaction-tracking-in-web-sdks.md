---
title: Interaction tracking in Web SDKs
---

# Interaction tracking in Web SDKs

Use this document to understand how browser interaction tracking works in
`@contentful/optimization-web` and the React layer provided by `@contentful/optimization-react-web`.
It explains how entry views, clicks, hovers, Custom Flag views, page events, and custom events move
from browser behavior to Core event delivery.

For setup steps, see
[Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
and
[Integrating the Optimization React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md).
For server-owned rendering, see
[Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md).

<details>
  <summary>Table of Contents</summary>

- [Tracking boundary](#tracking-boundary)
- [Layer responsibilities](#layer-responsibilities)
- [Event paths](#event-paths)
- [Consent and profile gates](#consent-and-profile-gates)
- [Tracked entry metadata](#tracked-entry-metadata)
- [Runtime control and precedence](#runtime-control-and-precedence)
- [DOM discovery](#dom-discovery)
- [View tracking mechanics](#view-tracking-mechanics)
- [Click tracking mechanics](#click-tracking-mechanics)
- [Hover tracking mechanics](#hover-tracking-mechanics)
- [React Web mechanics](#react-web-mechanics)
- [Delivery and flushing](#delivery-and-flushing)
- [Debugging model](#debugging-model)
- [Design boundaries](#design-boundaries)
- [Reference](#reference)

</details>

## Tracking boundary

Interaction tracking has two separate jobs:

- **Detection** - Observing browser state or application calls and deciding that an interaction
  happened.
- **Delivery** - Building a valid Optimization event, applying consent and profile gates, and
  sending the event to the correct API.

The Web SDK owns browser detection for Contentful entry views, clicks, and hovers. Core owns event
construction, consent checks, queues, profile state, and API delivery. React Web does not implement
a separate tracking engine; it renders Web SDK tracking metadata and exposes the underlying Web SDK
tracking API through React providers and hooks.

This split keeps the browser-specific code small. A view observer can focus on
`IntersectionObserver`, timers, and DOM lifecycle. Core can focus on whether a `trackView()` call is
allowed, which event type it becomes, and which queue receives it.

## Layer responsibilities

| Layer                                | Responsibility in interaction tracking                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-core`      | Builds `page`, `identify`, `track`, entry view, entry click, entry hover, and Custom Flag view events. Applies consent gates. Queues Experience API and Insights API work.     |
| `@contentful/optimization-web`       | Initializes Core for a browser runtime. Persists consent, profile data, selected optimizations, and anonymous IDs. Discovers tracked DOM elements and observes interactions.   |
| `@contentful/optimization-react-web` | Creates and tears down the Web SDK instance, resolves entries in React, emits `data-ctfl-*` attributes, exposes `interactionTracking`, and emits router-driven `page()` calls. |

The application still owns Contentful fetching, rendering policy, consent UX, identity policy, route
ownership, and any business event taxonomy passed to `track()`.

## Event paths

Tracking events use two API paths:

| Path           | Methods                                                                     | Main effect                                                                                   |
| -------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Experience API | `page()`, `identify()`, `screen()`, `track()`, sticky `trackView()`         | Evaluates or updates a profile and returns `profile`, `selectedOptimizations`, and `changes`. |
| Insights API   | non-sticky `trackView()`, `trackClick()`, `trackHover()`, `trackFlagView()` | Sends Analytics events for entry interactions and Custom Flag observations.                   |

The Web SDK normally starts a browser journey with `page()` or `identify()`. Those calls use the
Experience API and populate the state that later Insights events need for attribution. If an
Insights event is emitted before the stateful SDK has a profile, Core logs a warning and drops that
Insights event because there is no profile to attach to the batch.

The entry interaction methods map to these wire event types:

| SDK method        | Wire type                                    | Common source                                                            |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `trackView()`     | `component`                                  | `IntersectionObserver` entry view detection, or direct application call. |
| `trackClick()`    | `component_click`                            | Document click listener, or direct application call.                     |
| `trackHover()`    | `component_hover`                            | Pointer or mouse hover listener, or direct application call.             |
| `trackFlagView()` | `component` with `componentType: 'Variable'` | `getFlag()` and `states.flag(name)` reads from stateful Core.            |

Sticky entry views touch both paths. When `trackView({ sticky: true, ... })` is called, Core sends
the view through Experience first, then sends an Insights view event. Non-sticky views only use
Insights.

## Consent and profile gates

The Web SDK defaults `allowedEventTypes` to `['identify', 'page']`. Until consent is accepted, Core
blocks non-allowed event types such as `track`, `component`, `component_click`, and
`component_hover`.

Consent affects two parts of automatic entry tracking:

- **Observer startup** - Auto-enabled entry interaction detectors start only when consent is `true`.
  Calling `consent(false)` stops those auto-enabled detectors.
- **Event delivery** - Every event call still passes through Core's consent guard. Manual
  `tracking.enableElement(...)` can force an element detector to run, but emitted events are still
  blocked unless consent or `allowedEventTypes` permits the event type.

This means a typical browser integration needs both:

1. A profile-producing event such as `page()` or `identify()`.
2. Consent or an explicit event allow-list for the interaction event types the application wants to
   send.

Blocked events are observable through `onEventBlocked` and `states.blockedEventStream`. Events that
are blocked by consent are not replayed later when consent changes.

## Tracked entry metadata

Automatic tracking starts from DOM metadata. The Web SDK looks for HTML or SVG elements with a
non-empty `data-ctfl-entry-id` attribute.

| Attribute                                     | Used for                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `data-ctfl-entry-id`                          | Required. Becomes `componentId` in entry interaction events.                                         |
| `data-ctfl-optimization-id`                   | Optional. Becomes `experienceId`.                                                                    |
| `data-ctfl-sticky`                            | Optional. `true` sends the first successful view for the element through the sticky Experience path. |
| `data-ctfl-variant-index`                     | Optional. Non-negative integer used as `variantIndex`; invalid or unsafe values are ignored.         |
| `data-ctfl-track-views`                       | Optional. `true` or `false` override for view observation when the view detector is running.         |
| `data-ctfl-track-clicks`                      | Optional. `true` or `false` override for click observation when the click detector is running.       |
| `data-ctfl-track-hovers`                      | Optional. `true` or `false` override for hover observation when the hover detector is running.       |
| `data-ctfl-view-duration-update-interval-ms`  | Optional. Per-element interval for periodic view-duration updates.                                   |
| `data-ctfl-hover-duration-update-interval-ms` | Optional. Per-element interval for periodic hover-duration updates.                                  |
| `data-ctfl-clickable`                         | Optional. `true` marks a non-semantic element as part of a clickable path for click tracking.        |

The tracking payload uses the resolved entry ID, not the baseline entry ID. When an application
needs the baseline ID for rerendering, store it separately, for example in `data-ctfl-baseline-id`.
The Web SDK does not use `data-ctfl-baseline-id` in event payloads.

Manual element observation can provide the same metadata without DOM attributes:

```ts
optimization.tracking.enableElement('views', element, {
  data: {
    entryId: resolvedEntry.sys.id,
    optimizationId: selectedOptimization?.experienceId,
    sticky: selectedOptimization?.sticky,
    variantIndex: selectedOptimization?.variantIndex,
  },
})
```

When manual `data` is valid, it takes precedence over `data-ctfl-*` values on the element. If manual
data is missing or invalid, the detector falls back to the element attributes.

## Runtime control and precedence

Automatic tracking is opt-in. If `autoTrackEntryInteraction` is omitted, all automatic interaction
types default to `false`:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  autoTrackEntryInteraction: {
    views: true,
    clicks: true,
    hovers: false,
  },
})
```

The same runtime can be controlled after initialization:

| API                                                      | Effect                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `tracking.enable(interaction, options?)`                 | Enables automatic observation for `'views'`, `'clicks'`, or `'hovers'`.                            |
| `tracking.disable(interaction)`                          | Disables automatic observation for that interaction and stops it when no manual overrides need it. |
| `tracking.enableElement(interaction, element, options?)` | Force-enables one element, even when global automatic tracking for that interaction is off.        |
| `tracking.disableElement(interaction, element)`          | Force-disables one element.                                                                        |
| `tracking.clearElement(interaction, element)`            | Removes the manual override so the element falls back to attribute overrides or automatic state.   |

For each element, the runtime resolves tracking in this order:

1. Manual API override from `enableElement(...)` or `disableElement(...)`.
2. Per-element `data-ctfl-track-*` override.
3. Global automatic tracking state and the element registry.

`reset()` stops interaction trackers and clears manual element overrides. `destroy()` also
disconnects DOM observers and browser lifecycle listeners.

## DOM discovery

The Web SDK has one shared entry element registry. When an interaction detector starts, the registry
does two things:

- Seeds the initial set from `document.querySelectorAll('[data-ctfl-entry-id]')`.
- Subscribes to a `MutationObserver` that watches child additions and removals in the document
  subtree.

When a tracked element is added, the registry notifies the running view, click, and hover detectors.
When a tracked element is removed, the registry notifies those detectors so they can unobserve the
element or stop treating it as tracked.

The registry observes element existence, not arbitrary attribute changes. Entry payload attributes
such as `data-ctfl-entry-id` are read when an event fires, so updated IDs can affect later payloads.
Per-element tracking overrides such as `data-ctfl-track-views` and interval attributes are resolved
when the element is added to the detector. If an existing mounted element needs dynamic override
changes, use the `tracking.*Element(...)` API or remount the tracked element.

## View tracking mechanics

View tracking uses `IntersectionObserver` and dwell-time timers.

Default view settings:

| Setting                             | Default  |
| ----------------------------------- | -------- |
| Required visible dwell time         | 1000 ms  |
| Periodic duration update interval   | 5000 ms  |
| Minimum visible ratio               | 0.1      |
| `IntersectionObserver` root         | `null`   |
| `IntersectionObserver` root margin  | `0px`    |
| Disconnected-element sweep interval | 30000 ms |

A view cycle works like this:

1. The element crosses the configured visibility threshold.
2. The observer starts a fresh cycle, assigns a `viewId`, resets accumulated duration, and starts
   the dwell timer.
3. After the dwell time passes, the observer calls `trackView()` with `viewId` and `viewDurationMs`.
4. While the element remains visible, the observer sends periodic duration updates using the same
   `viewId`.
5. When the element leaves view after at least one view event fired, the observer sends a final
   duration update.
6. If the element leaves view before dwell time completes, the cycle resets without sending an
   event.

The observer pauses dwell accumulation when the page is hidden and resumes when the page becomes
visible again. It coalesces in-flight callbacks so a slow or failing event send does not create
duplicate concurrent sends for the same element. If visibility ends while an event send is in
flight, the final duration update is sent after that in-flight attempt settles.

Sticky view handling is per DOM element. If the payload has `sticky: true`, the first view attempt
for that element sends `sticky: true` to Core. After Core returns optimization data for that sticky
view, later view events for the same element omit `sticky`. If the sticky attempt does not return
optimization data, the detector retries sticky on the next visibility cycle for that element.
Separately rendered elements with the same entry ID are treated as separate sticky targets.

## Click tracking mechanics

Click tracking uses one document-level capture listener. It does not call `preventDefault()` or
`stopPropagation()`.

When a click occurs, the detector resolves two facts:

- Which tracked entry element owns the click.
- Whether the event path is semantically clickable.

The click detector treats these paths as clickable:

- `a[href]`
- `button`
- non-hidden `input`
- `select`
- `textarea`
- `summary`
- `[role="button"]`
- `[role="link"]`
- `[onclick]`
- elements with an `onclick` property handler
- `[data-ctfl-clickable="true"]`

The tracked entry can be the clicked element, an ancestor of the clicked element, or a descendant of
a clickable ancestor. The detector also handles click events whose original target is a text node by
walking to the parent element.

If a tracked entry and a clickable path are found, the detector resolves entry metadata and calls
`trackClick()`. Click events do not include a click duration or click ID; the payload carries the
entry and optimization metadata.

## Hover tracking mechanics

Hover tracking uses element-level listeners. When `PointerEvent` is available, the observer listens
for `pointerenter`, `pointerleave`, and `pointercancel`, and ignores touch pointer events. When
pointer events are unavailable, it falls back to `mouseenter` and `mouseleave`.

Default hover settings:

| Setting                             | Default  |
| ----------------------------------- | -------- |
| Required hover dwell time           | 1000 ms  |
| Periodic duration update interval   | 5000 ms  |
| Disconnected-element sweep interval | 30000 ms |

A hover cycle mirrors the view cycle:

1. The pointer enters a tracked element.
2. The observer starts a fresh cycle, assigns a `hoverId`, resets accumulated duration, and starts
   the dwell timer.
3. After dwell time passes, the observer calls `trackHover()` with `hoverId` and `hoverDurationMs`.
4. While the pointer remains hovered, the observer sends periodic duration updates using the same
   `hoverId`.
5. When the pointer leaves after at least one hover event fired, the observer sends a final duration
   update.
6. If hover ends before dwell time completes, the cycle resets without sending an event.

Like view tracking, hover tracking pauses while the page is hidden, coalesces in-flight callbacks,
and sweeps disconnected element state.

## React Web mechanics

React Web wraps the Web SDK; it does not replace the Web SDK tracking runtime.

`OptimizationRoot` creates one `ContentfulOptimization` instance from its props and destroys that
instance on unmount. `autoTrackEntryInteraction`, `allowedEventTypes`, `defaults`, `queuePolicy`,
and other Web SDK configuration values pass through to the underlying instance.

`OptimizedEntry` does three tracking-related things:

- Resolves the baseline entry with `useOptimizedEntry()`.
- Renders a wrapper element with `display: contents`.
- Adds tracking attributes for the resolved entry when resolved content is ready.

The wrapper receives:

```html
<div
  data-ctfl-entry-id="resolved-entry-id"
  data-ctfl-optimization-id="experience-id"
  data-ctfl-sticky="true"
  data-ctfl-variant-index="1"
  data-ctfl-duplication-scope="session"
></div>
```

`data-ctfl-duplication-scope` is emitted by React Web for optimization metadata, but the Web SDK
entry interaction payload does not use it.

During loading, `OptimizedEntry` does not emit resolved entry tracking attributes. Loading UI is
therefore not tracked as the resolved Contentful entry. If `children` is a direct `ReactNode`
instead of a render prop, the wrapper still receives tracking attributes, but the child content does
not change based on the resolved entry.

`useOptimizedEntry()` only resolves data. It does not add DOM attributes or register an element. If
a component uses `useOptimizedEntry()` directly, it must either render the `data-ctfl-*` attributes
itself or use `interactionTracking.enableElement(...)`.

React Web router adapters emit `page()` calls when supported routers change route. They are page
event helpers, not entry interaction detectors. Entry views, clicks, and hovers still come from the
Web SDK runtime.

## Delivery and flushing

Insights events are queued by current profile ID and sent in batches. The queue flushes
periodically, flushes when the queued event count reaches the batch threshold, and can be flushed
explicitly with `optimization.flush()`.

Experience events are sent immediately when the browser is online. When the browser is offline,
Experience events are queued up to the configured offline maximum and replayed when the online
signal becomes `true`.

The Web SDK wires browser lifecycle events into this queue model:

- `online` and `offline` update Core's online signal. Going online forces a flush.
- `visibilitychange`, `pagehide`, and `beforeunload` call `flush()` once per hide cycle.
- Insights delivery uses the configured beacon handler, which defaults to `navigator.sendBeacon()`.

Browser persistence is best-effort. Consent, profile, selected optimizations, Custom Flag changes,
and the anonymous ID are read from `localStorage` at startup when available. The anonymous ID is
also persisted in the `ctfl-opt-aid` cookie and migrated from the legacy anonymous ID cookie when
present.

## Debugging model

When an expected interaction does not appear, check the gates in this order:

1. **Profile** - Call `page()` or `identify()` before relying on Insights events. Insights delivery
   needs a current profile in state.
2. **Consent** - Confirm `states.consent.current === true` or configure `allowedEventTypes` for the
   event types that must emit before consent.
3. **Detector startup** - Confirm `autoTrackEntryInteraction` or `tracking.enable(...)` is enabled
   for the relevant interaction.
4. **Element metadata** - Confirm the tracked element is an HTML or SVG element with non-empty
   `data-ctfl-entry-id`, or that `enableElement(...)` supplies valid `data.entryId`.
5. **View threshold** - Confirm the element stays above `minVisibleRatio` for `dwellTimeMs`.
6. **Clickability** - Confirm clicks happen on a semantic clickable path or an element marked with
   `data-ctfl-clickable="true"`.
7. **Hover source** - Confirm the event is not a touch pointer event and that the pointer remains
   over the element long enough to satisfy dwell time.
8. **Manual override precedence** - Confirm `disableElement(...)` or `data-ctfl-track-*="false"` is
   not suppressing the element.

For local diagnostics, subscribe to `states.eventStream` and `states.blockedEventStream`, and use
`onEventBlocked` for consent-gating visibility.

## Design boundaries

The Web SDKs do not own every part of tracking:

- They do not fetch Contentful entries.
- They do not decide whether a user has granted consent.
- They do not infer a browser view from server rendering alone.
- They do not make non-clickable markup clickable.
- They do not replay events blocked before consent.
- They do not guarantee persistence in browsers that deny storage access.

Keep these boundaries explicit when integrating or changing tracking behavior. Detection belongs to
the browser runtime, event semantics belong to Core, and application-specific policy stays in the
application.

## Reference

- [Core state management](./core-state-management.md) - Core state, consent, queues, observables,
  and event streams.
- [Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md) -
  How resolved entries and selected optimization metadata are produced before tracking metadata is
  rendered.
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md) -
  How browser tracking fits when server runtimes own personalization.
- [Optimization Web SDK README](../../packages/web/web-sdk/README.md) - Package-level orientation
  and Web SDK setup options.
- [Optimization React Web SDK README](../../packages/web/frameworks/react-web-sdk/README.md) - React
  provider, hook, router, and entry-rendering orientation.
- [Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md) -
  Step-by-step browser integration flow.
- [Integrating the Optimization React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md) -
  Step-by-step React integration flow.
