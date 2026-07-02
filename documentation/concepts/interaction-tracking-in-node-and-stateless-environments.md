---
title: Interaction tracking in Node and stateless environments
---

# Interaction tracking in Node and stateless environments

Use this concept document when a Node or stateless server runtime owns personalization and
rendering, but the application still needs Analytics events for server-rendered content. It explains
what the Node SDK can track from the server, what requires a browser runtime, and how
server-generated HTML can use the Web SDK for interaction tracking without moving personalization
client-side.

For step-by-step server setup, see
[Integrating the Optimization Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md).
For browser setup, see
[Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md).
For Web SDK interaction tracking mechanics, see
[Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md). For profile handoff
between server and browser, see
[Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime decision summary](#runtime-decision-summary)
- [Constraints that decide delivery](#constraints-that-decide-delivery)
- [The core boundary](#the-core-boundary)
- [What stateless tracking means](#what-stateless-tracking-means)
- [Event paths](#event-paths)
- [Server-side tracking capabilities](#server-side-tracking-capabilities)
- [Browser-side interaction capabilities](#browser-side-interaction-capabilities)
- [Use the Web SDK for tracking server-generated HTML](#use-the-web-sdk-for-tracking-server-generated-html)
  - [Render tracking metadata on resolved entries](#render-tracking-metadata-on-resolved-entries)
  - [Initialize the Web SDK without client-side personalization](#initialize-the-web-sdk-without-client-side-personalization)
  - [Choose how the browser gets a profile](#choose-how-the-browser-gets-a-profile)
  - [Keep personalization server-owned](#keep-personalization-server-owned)
  - [React meta-framework SSR with client tracking](#react-meta-framework-ssr-with-client-tracking)
- [Server-only interaction tracking](#server-only-interaction-tracking)
- [Manual browser tracking without the Web SDK](#manual-browser-tracking-without-the-web-sdk)
- [Stateless runtime constraints](#stateless-runtime-constraints)
- [Architecture choices](#architecture-choices)
- [Implementation checklist](#implementation-checklist)
- [Related docs](#related-docs)

<!-- mtoc-end -->
</details>

## Runtime decision summary

Choose the runtime path before designing the event flow. The SDK that renders or observes the
interaction decides which facts are available.

| Path                                        | Runtime responsibility                                                                                                                                                                                                                                                                                                                         | Use when                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-node`             | Bind request consent, locale, profile, and page context; call Experience API methods; resolve entries; emit server-known events.                                                                                                                                                                                                               | Server rendering owns personalization, and the event is a request fact or server-observed business action.                           |
| `@contentful/optimization-web`              | Own browser consent state, profile state, storage, automatic DOM observation, browser queues, and Insights delivery.                                                                                                                                                                                                                           | Non-React or custom browser code needs view, click, hover, route, or manual element tracking after HTML reaches the page.            |
| `@contentful/optimization-react-web`        | Wrap the Web SDK with React browser providers, hooks, router trackers, and `OptimizedEntry` from `@contentful/optimization-react-web`.                                                                                                                                                                                                         | React browser apps need framework-owned state, route page tracking, entry wrappers, or browser-side entry personalization.           |
| `@contentful/optimization-nextjs`           | Own Next.js adapter surfaces: server helpers and `ServerOptimizedEntry` from `@contentful/optimization-nextjs/server`, request helpers from `@contentful/optimization-nextjs/request-handler`, tracking helpers from `@contentful/optimization-nextjs/tracking-attributes`, and client wrappers from `@contentful/optimization-nextjs/client`. | Next.js apps need server-owned personalization, request and cookie helpers, SSR tracking attributes, and client tracking boundaries. |
| First-party browser collector plus Node SDK | Observe browser interactions in application code, post observations to an app endpoint, validate policy, and call request-bound Node SDK tracking methods.                                                                                                                                                                                     | The browser cannot run the Web SDK, but the app can own DOM observation, payload mapping, profile continuity, and retries.           |

## Constraints that decide delivery

Apply these constraints before choosing server-only, hybrid, or manual tracking:

- Consent is application policy. The SDK blocks events unless consent or `allowedEventTypes` permits
  the event type.
- Persistence consent decides whether profile continuity can survive beyond the current runtime.
  Persist `ctfl-opt-aid`, browser profile state, selected optimizations, and changes only when that
  policy permits durable continuity.
- Browser entry interactions use the wire event types `component`, `component_click`, and
  `component_hover`. Custom Flag views use `component` with `componentType: 'Variable'`, but
  `allowedEventTypes` also accepts `flag` as a Custom Flag view selector. `component` allows both
  entry views and flag views before consent; `flag` narrows pre-consent admission to Custom Flag
  views without entry views.
- Browser Insights delivery needs a current Web SDK profile. In direct Web SDK initialization, the
  profile can come from `defaults.profile`. In React Web and Next.js provider handoff, pass
  server-returned Optimization data through `serverOptimizationState` (the deprecated
  `NextjsOptimizationState` marker remains for hydrating page-specific data under an existing
  provider). The profile can also come from browser-persisted profile state that persistence consent
  allows the SDK to load, or a browser Experience API call such as `page()`, `identify()`,
  `track()`, or sticky `trackView()`.
- Browser storage is best-effort. The Web SDK uses `localStorage` and the `ctfl-opt-aid` cookie when
  persistence consent permits continuity; if storage fails or is unavailable, continuity is limited
  to in-memory state.
- Serverless memory and background work are not durable stores. Await important server-side event
  calls before the response completes, or hand them to an application-owned durable queue.
- Offline browser queues are best-effort and browser-owned. They cannot make the original server
  request observe a later view, click, or hover.

## The core boundary

The Node SDK can emit events, but it cannot observe a rendered page after the response leaves the
server. That boundary is the main design constraint for interaction tracking in SSR, server
functions, and other stateless environments.

A server request can know:

- which URL or route was requested
- which profile ID arrived with the request, if the application persisted one
- which Contentful baseline entry was fetched
- which variant `resolveOptimizedEntry()` selected from the current `selectedOptimizations`
- which HTML the server attempted to send
- which server-side business action happened, such as a form submission or checkout callback

A server request cannot know by itself:

- whether the browser received, rendered, or kept the HTML visible
- whether an entry crossed a viewport visibility threshold
- how long the entry stayed visible or hovered
- whether a real user clicked a rendered entry
- whether a client-side route changed after hydration
- whether consent changed after the response
- whether queued browser events flushed before unload

This means Node-only tracking can describe server-observed facts. Accurate view, click, and hover
tracking for server-generated HTML still needs code in the browser or another runtime that can
observe the final user interface.

## What stateless tracking means

The Node SDK extends the stateless Core runtime. You can create one singleton SDK instance per
module or process, but that singleton does not keep durable profile, consent, page, cookie, session,
or browser-storage state across requests. Bind each incoming request's inputs with `forRequest()`
before emitting events.

The object returned by `forRequest()` is request-local. It retains the profile, consent, locale,
page context, and request options passed at construction for that object's lifecycle. Experience API
responses from `page()`, `identify()`, `track()`, `screen()`, and sticky `trackView()` update that
request-local profile, so later calls on the same request object can use the updated profile. Do not
reuse a request object across independent HTTP requests.

In practice, the application must supply:

- the current profile ID, usually from `ANONYMOUS_ID_COOKIE` (`ctfl-opt-aid`) or a session
- the application policy decision for whether the server can call the SDK
- page context such as `path`, `url`, `referrer`, `query`, and locale
- user agent and optional IP override when server-side evaluation needs client request metadata
- the selected entry metadata needed for entry interaction events

The stateless methods are side-effecting API calls, not cacheable reads. Cache raw Contentful
delivery payloads and resolve them per request. Do not cache `page()`, `identify()`, `track()`,
`screen()`, `trackView()`, `trackClick()`, `trackHover()`, or `trackFlagView()` responses as if they
were pure data lookups.

## Event paths

Tracking uses two API paths with different semantics:

| Path           | Methods                                                                     | Purpose                                                                 | Profile behavior                                                                        |
| -------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Experience API | `page()`, `identify()`, `screen()`, `track()`, sticky `trackView()`         | Evaluates or updates a profile and returns accepted/data event results. | Uses the profile ID bound with `forRequest()`. If absent, the API can create a profile. |
| Insights API   | non-sticky `trackView()`, `trackClick()`, `trackHover()`, `trackFlagView()` | Sends fire-and-forget Analytics interaction events.                     | Requires a request-bound profile because there is no ambient SDK state.                 |

Sticky entry views are the exception that touches both paths. In Node, `trackView({ sticky: true })`
sends a view event through Experience first, then sends the paired Insights event using the profile
returned by the Experience response. Non-sticky `trackView()` only uses Insights and therefore
requires a request-bound profile ID.

The interaction wire event types are:

| SDK method        | Wire type                                    | Common meaning        |
| ----------------- | -------------------------------------------- | --------------------- |
| `trackView()`     | `component`                                  | Entry exposure.       |
| `trackClick()`    | `component_click`                            | Entry click.          |
| `trackHover()`    | `component_hover`                            | Entry hover.          |
| `trackFlagView()` | `component` with `componentType: 'Variable'` | Custom Flag exposure. |

## Server-side tracking capabilities

Use the Node SDK for events that the server can state truthfully.

Server-side `page()` is the normal SSR entry point. It records the page request, returns
`OptimizationData`, and gives the server `profile`, `selectedOptimizations`, and `changes` for the
render.

The examples below bind application-owned consent into a request-scoped client. Node SDK event calls
fail closed except for the configured `allowedEventTypes`; the Node default permits `identify` and
`page` before consent and labels those events as not consented.

Choose an application locale from your router, i18n, or request logic. Use that same value for CDA
fetches and pass it to `forRequest({ locale })` when Experience API responses and events need to use
that locale. For the broader locale model, see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

```ts
const appLocale = getAppLocale(req)
const requestOptimization = optimization.forRequest({
  consent: {
    events: appPolicyAllowsOptimizationEvent(req),
    persistence: appPolicyAllowsOptimizationEvent(req),
  },
  locale: appLocale,
  eventContext: {
    page: {
      path: req.path,
      query,
      referrer: req.get('referer') ?? '',
      search: url.search,
      url: url.toString(),
    },
    userAgent: req.get('user-agent') ?? 'node-server',
  },
  profile: profileId ? { id: profileId } : undefined,
})

const pageResult = await requestOptimization.page()
const pageResponse = pageResult.accepted ? pageResult.data : undefined

if (!pageResponse) {
  renderBaselineResponse()
  return
}
```

Use server-side `track()` for server-known business events:

```ts
const appLocale = getAppLocale(req)

if (!pageResponse) {
  return
}

const requestOptimization = optimization.forRequest({
  consent: true,
  locale: appLocale,
  profile: pageResponse.profile,
})

await requestOptimization.track({
  event: 'quote_requested',
  properties: {
    plan: 'enterprise',
    source: 'pricing-page',
  },
})
```

Use server-side `trackView()` only when the event definition is "the server rendered this entry into
the response", not "the user saw this entry in the viewport". If the business meaning requires real
visibility, use browser tracking.

```ts
import { randomUUID } from 'node:crypto'

const appLocale = getAppLocale(req)

if (!pageResponse) {
  return
}

const { entry: resolvedEntry, selectedOptimization } = optimization.resolveOptimizedEntry(
  baselineEntry,
  pageResponse.selectedOptimizations,
)

const requestOptimization = optimization.forRequest({
  consent: true,
  locale: appLocale,
  profile: pageResponse.profile,
})

await requestOptimization.trackView({
  componentId: resolvedEntry.sys.id,
  experienceId: selectedOptimization?.experienceId,
  sticky: selectedOptimization?.sticky ?? false,
  variantIndex: selectedOptimization?.variantIndex,
  viewDurationMs: 0,
  viewId: randomUUID(),
})
```

Use `trackClick()` and `trackHover()` on the server only for interactions that the server actually
receives, such as a POST route, redirect route, or first-party event collection endpoint. A server
cannot infer a click or hover from the original HTML response.

## Browser-side interaction capabilities

The Web SDK owns browser runtime mechanics that stateless Node does not own:

- consent state and event blocking in the browser
- profile, selected optimization, and change state in memory and localStorage
- anonymous ID persistence in `ctfl-opt-aid`
- `sendBeacon` and `fetch(..., { keepalive: true })` delivery paths for Insights events
- offline and visibility-change flushing
- automatic DOM tracking for entry views, clicks, and hovers
- manual element tracking with `optimization.tracking.enableElement(...)`
- observable state for event streams and blocked-event diagnostics

For entry views, the Web SDK uses `IntersectionObserver`, dwell-time timers, visibility-change pause
and resume, periodic duration updates, and final duration events when visibility ends. For clicks,
it listens at the document level and resolves the nearest tracked entry plus a semantic clickable
path. For hovers, it uses pointer or mouse enter and leave events with dwell-time timers.

Those browser mechanics are useful even when the server owns every personalization decision.

## Use the Web SDK for tracking server-generated HTML

The hybrid pattern is:

1. Use `@contentful/optimization-node` on the server to evaluate the request, resolve entries, and
   render personalized HTML.
2. Add Web SDK tracking metadata to the rendered entry elements.
3. Initialize `@contentful/optimization-web` in the browser for consent, profile continuity, and
   interaction tracking.
4. Do not fetch Contentful entries or call `resolveOptimizedEntry()` in the browser unless the
   application also wants browser-side personalization after hydration.

This pattern keeps the personalization contract server-side while using the browser SDK for the part
of tracking that can only be measured in the browser.

### Render tracking metadata on resolved entries

Use SDK helpers when available instead of copying the attribute map into application code. In
Next.js, the isomorphic `OptimizedEntry` renders the Web SDK tracking attributes as part of
resolving the entry on the server; the deprecated `ServerOptimizedEntry` does the same from an
explicit `ResolvedData` for pure zero-JavaScript server rendering. For custom SSR wrappers, call
`getServerTrackingAttributes()` from `@contentful/optimization-nextjs/tracking-attributes`. Non-Next
runtimes can call `resolveOptimizedEntryTrackingAttributes()` from
`@contentful/optimization-web/tracking-attributes` when they already have the same baseline entry
and resolved data shape.

```tsx
import { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'

const trackingAttributes = getServerTrackingAttributes(baselineEntry, resolvedData, {
  clickable: true,
  trackHovers: false,
})

return <article {...trackingAttributes}>...</article>
```

Those helpers stay aligned with the current Web and React Web tracking attributes, including
per-element control attributes such as `data-ctfl-track-views`, `data-ctfl-track-clicks`,
`data-ctfl-track-hovers`, `data-ctfl-clickable`, `data-ctfl-view-duration-update-interval-ms`, and
`data-ctfl-hover-duration-update-interval-ms`.

If an application renders raw attributes manually, keep the stable browser tracking payload contract
separate from SDK control metadata:

| Attribute                           | Payload role                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `data-ctfl-entry-id`                | Required for automatic entry tracking. The browser tracker sends this resolved entry ID as `componentId`. |
| `data-ctfl-optimization-id`         | Optional optimized-entry metadata sent as `experienceId`.                                                 |
| `data-ctfl-optimization-context-id` | Optional SDK-owned context for event enrichment and diagnostics. It is not a public API event field.      |
| `data-ctfl-duplication-scope`       | Optional helper-emitted SDK optimization metadata. The Web SDK interaction payload does not use it.       |
| `data-ctfl-sticky`                  | Optional `true` value that marks entry views as sticky.                                                   |
| `data-ctfl-variant-index`           | Optional selected variant index.                                                                          |

`data-ctfl-baseline-id` is SDK-recognized metadata for the baseline entry associated with the
resolved entry. It is not used as `componentId`, and the browser tracker does not send it in
interaction event payloads. The tracking payload uses the resolved entry ID from
`data-ctfl-entry-id`.

### Initialize the Web SDK without client-side personalization

This browser code uses the Web SDK's default browser observation for views and clicks, opts out of
hover observation, and does not fetch entries or resolve variants. It assumes the Web SDK
constructor is provided by your browser bundle or approved script delivery path. Browser interaction
delivery depends on consent or `allowedEventTypes` and a current Web SDK profile:

```html
<script>
  const optimization = new ContentfulOptimization({
    clientId: window.__OPTIMIZATION_CONFIG__.clientId,
    environment: window.__OPTIMIZATION_CONFIG__.environment,
    app: { name: document.title, version: '1.0.0' },
    defaults: {
      consent: window.__OPTIMIZATION_CONSENT__,
      profile: window.__OPTIMIZATION_DATA__?.profile,
    },
    autoTrackEntryInteraction: { hovers: false },
  })

  document.querySelector('#accept-consent')?.addEventListener('click', () => {
    optimization.consent(true)
  })

  document.querySelector('#reject-consent')?.addEventListener('click', () => {
    optimization.consent(false)
  })
</script>
```

This is not client-side personalization. The browser SDK is present only to own browser state,
observe DOM interactions, and deliver Analytics events for elements the server already rendered.

### Choose how the browser gets a profile

Browser Insights events need a current Web SDK profile. A readable `ctfl-opt-aid` cookie gives the
browser the anonymous ID, but the Web SDK's Insights queue uses the current profile signal for event
delivery. Choose one of these patterns before enabling interaction tracking:

- **Bootstrap the server profile.** For direct Web SDK initialization, serialize the `profile`
  returned by the server's `page()` or `identify()` call and pass it as `defaults.profile`. For
  React Web and Next.js, pass the server `OptimizationData` through `serverOptimizationState` (the
  deprecated `NextjsOptimizationState` marker remains for hydrating page-specific data under an
  existing provider). Use this when the same server response already rendered personalized HTML from
  that profile.
- **Re-evaluate in the browser.** Persist `ctfl-opt-aid` on the server, initialize the Web SDK in
  the browser, call `page()` after your consent policy allows it, then enable tracking after the
  page response populates browser profile state.
- **Use a first-party collection endpoint.** If you do not want the browser to hold the full
  profile, custom browser code can send interaction observations to your server, and the server can
  call the Node SDK with the request's profile ID. This is a manual tracking architecture, not the
  Web SDK auto-tracking path.

In Next.js SSR integrations, `initialPageEvent="skip"` intentionally avoids the initial browser
Experience API `page()` request when the server already emitted that page event. If that skip leaves
the browser without `serverOptimizationState` or `NextjsOptimizationState`, and without a prior
persisted browser profile, automatic entry views, clicks, and hovers cannot deliver until a later
browser Experience API call populates profile state.

If the Web SDK must read `ctfl-opt-aid`, do not mark that cookie as `HttpOnly`. Configure `path`,
`domain`, and `SameSite` so the server route and browser code refer to the same profile.

### Keep personalization server-owned

When the browser SDK is used only for tracking:

- Do not include a Contentful delivery client in the browser unless another feature needs it.
- Do not subscribe to `states.selectedOptimizations` for rerendering.
- Do not call `resolveOptimizedEntry()` in the browser.
- Do not let browser-side `page()` responses replace server-rendered content unless the architecture
  intentionally supports live client-side updates.
- Treat the server-rendered HTML as personalized output for cache purposes.

The Web SDK can still update browser profile state after `page()`, `identify()`, `track()`, or
sticky `trackView()` calls. If the application ignores those state changes, the rendered content
remains server-owned.

### React meta-framework SSR with client tracking

The [Next.js SDK SSR reference implementation](../../implementations/nextjs-sdk_ssr/README.md) is
one concrete example of the same tracking-only browser pattern. In Next.js, prefer the
`@contentful/optimization-nextjs` adapter subpaths so app code uses the adapter's server,
request-handler, and client entries rather than wiring the lower-level Node and React Web packages
directly. The same ownership guidance applies to any React-based meta-framework that can render
React code on the server and hydrate part of that tree in the browser.

Keep personalization server-owned by enforcing these boundaries:

- Server-only modules, routes, loaders, middleware, actions, or Server Components import server-only
  SDK entrypoints, call the request-bound page path, call `sdk.resolveOptimizedEntry(...)`, and
  render plain React elements. In Next.js, those imports come from
  `@contentful/optimization-nextjs/server` and `@contentful/optimization-nextjs/request-handler`.
- Server-rendered entry wrappers include adapter/server-generated `data-ctfl-*` tracking attributes,
  so the browser tracking runtime can observe them after hydration.
- Client-only modules import browser entrypoints for `OptimizationRoot`, router page tracking,
  consent controls, identify controls, and automatic interaction tracking. In Next.js, those imports
  come from `@contentful/optimization-nextjs/client`.
- `OptimizationRoot` and router page trackers stay behind the framework's client-only boundary, so
  the browser runtime is not instantiated during SSR. Next.js App Router can render the adapter's
  Client Component exports from a Server Component layout; other frameworks need the equivalent
  client-only island, lazy hydration, or browser-only wrapper.
- The client tree does not use `OptimizedEntry`, `useOptimizedEntry`, or browser-side
  `resolveOptimizedEntry()`.
- Client rendering does not consume `defaults.selectedOptimizations` or
  `states.selectedOptimizations` to choose entry variants. When persistence consent is true, the Web
  SDK can load persisted selected optimizations for state continuity, but tracking-only client code
  must not use browser selected-optimization state to render already server-rendered entries.

This split avoids the common accidental-client-personalization path in React apps. `OptimizedEntry`
is the React Web SDK's browser-personalization component; using it in a hydrated client tree can
cause the browser to resolve variants from client SDK state. For server-only personalization, render
the resolved entry in the server-owned render path and use the client SDK only for tracking and
controls.

After hydration, client actions can still update the profile. For example, `sdk.identify()` can
associate the visitor with a known user, and `sdk.consent(true)` can allow interaction tracking.
Those actions do not change the already rendered HTML in the reference pattern. The user sees
updated personalization on the next server request, such as a refresh or full navigation, when the
server SDK evaluates the updated profile and renders a new response.

The exact framework primitive is less important than the ownership boundary. If a framework can run
the same React module on both the server and the browser, do not put personalization and tracking
concerns in that shared module. Keep server SDK calls in server-only code, keep browser SDK calls in
client-only code, and exchange only durable handoff data such as the profile ID and rendered
tracking attributes.

## Server-only interaction tracking

A server-only application can still emit useful tracking, but the event names must match server
facts.

Use Node-only tracking for:

- page requests
- known identity transitions
- server-side form submissions
- checkout, subscription, or account events that complete on the server
- rendered-entry events where "rendered in the response" is the intended measurement
- Custom Flag views when the flag was evaluated and rendered on the server

Do not use Node-only tracking for:

- viewport exposure
- dwell time
- hover time
- client-side route changes
- click events that do not hit the server
- unload-sensitive event flushing

If the application wants to count entry exposure as "included in SSR HTML", make that definition
explicit in dashboards and experiment analysis. It is a different metric from a browser viewport
view.

## Manual browser tracking without the Web SDK

A consumer can choose not to run the Web SDK in the browser, but then the application owns the
browser tracking system. The server Node SDK does not fill that gap by itself.

A manual solution needs to implement at least these areas:

| Area           | Work the application must own                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity       | Read or receive the profile ID, handle anonymous and known identity, keep server and browser continuity aligned, and avoid cross-user leakage.                                          |
| Consent        | Store the user's decision, block or allow event types consistently, and define what happens to profile continuity after revocation.                                                     |
| Event payloads | Build valid event shapes with `channel`, context, `messageId`, timestamps, `componentType`, `componentId`, `experienceId`, and `variantIndex`.                                          |
| DOM registry   | Find server-rendered entry elements, detect added and removed elements, support nested entries, and clean up observers.                                                                 |
| View tracking  | Use `IntersectionObserver`, define visible ratio and dwell time, pause on hidden tabs, emit periodic duration updates, emit final events, and reuse `viewId` within a visibility cycle. |
| Click tracking | Resolve the tracked entry from the click target, distinguish real clickable paths, support semantic elements and application clickability hints, and avoid duplicate events.            |
| Hover tracking | Ignore touch pointer hovers, measure dwell time, emit periodic and final hover durations, and clean up event listeners.                                                                 |
| Delivery       | Batch events by profile, retry or drop predictably, flush on `visibilitychange` or unload, and use `sendBeacon` or `keepalive` where appropriate.                                       |
| Sticky views   | Send sticky views through Experience, send paired Insights events, persist returned profile state, and avoid repeated sticky mutations for the same element.                            |
| Diagnostics    | Record blocked events, failed deliveries, missing profile state, invalid metadata, and observer errors without breaking the host page.                                                  |

There are two common manual transport choices:

- **Direct browser ingestion.** Browser code constructs Insights API batches and sends them to the
  Insights API. This requires the browser to build all payloads correctly and hold the profile data
  needed for event association.
- **First-party event endpoint.** Browser code posts small interaction observations to an
  application endpoint. The server validates consent and identity, then calls `trackView()`,
  `trackClick()`, or `trackHover()` through the Node SDK. This keeps API details server-side but
  still requires custom browser observation logic.

The manual endpoint option can be appropriate for strict data-exposure policies, but it is not a
small replacement for the Web SDK. It moves the transport and policy boundary to the server while
leaving the hardest observation work in browser code.

## Stateless runtime constraints

Serverless and stateless environments add operational constraints to tracking:

- A warm function can reuse a module-level SDK instance, but it cannot be trusted as a durable
  session store.
- In-memory queues can be lost when the runtime freezes or terminates.
- Background work started after the response can be cancelled by the platform.
- Parallel requests for the same visitor can arrive at different isolated workers.
- Shared HTML caches must vary on every personalization input or avoid personalized output.

For server-side events that matter, await the Node SDK call before the response completes or enqueue
the event in a durable application-owned queue. For browser-observed interactions, prefer browser
delivery through the Web SDK or an application endpoint that can accept events after the original
HTML request has finished.

## Architecture choices

| Architecture                                  | Use when                                                                                                                   | Tradeoff                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Node SDK only                                 | Personalization is server-side and analytics only needs request or server-known events.                                    | No accurate viewport, click, or hover tracking for static HTML unless those interactions hit the server.               |
| Node SDK plus Web SDK tracking                | Personalization is server-side, but rendered entries need browser view, click, or hover tracking.                          | Adds a browser SDK, consent wiring, and profile handoff, but avoids custom observer and delivery code.                 |
| Node SDK plus manual browser collector        | The browser cannot run the Web SDK, but the app can own custom observation code and send events to a first-party endpoint. | High implementation and maintenance cost. The app owns browser observers, payload semantics, retries, and diagnostics. |
| Browser SDK owns personalization and tracking | The first render can be baseline or loading state, and the browser can resolve variants after hydration.                   | More browser work and possible content shift, but profile state and interaction tracking live in one runtime.          |

The recommended hybrid for server-generated personalized HTML is Node SDK plus Web SDK tracking.
That architecture keeps the rendering decision on the server and uses the browser SDK only for the
runtime signals that the server cannot observe.

## Implementation checklist

Use this checklist when implementing interaction tracking for Node-rendered HTML:

- Decide which events are server facts and which require browser observation.
- Gate every Node SDK event with the application consent policy before calling the SDK.
- Persist the returned `profile.id` when consent allows continuity.
- Pass `{ profile: { id } }` into stateless Node calls when a profile ID exists.
- Render `data-ctfl-entry-id` with the resolved entry ID, not only the baseline entry ID.
- Render `data-ctfl-optimization-id`, `data-ctfl-sticky`, and `data-ctfl-variant-index` when an
  entry is an optimized variant.
- Initialize the Web SDK only once per page runtime if browser tracking is needed.
- Ensure the Web SDK has a profile before relying on Insights-backed auto tracking.
- Keep browser-side entry resolution disabled when personalization is intended to stay server-side.
- Treat personalized server HTML as personalized for cache policy, even if tracking runs in the
  browser.
- If avoiding the Web SDK, scope the manual solution as a browser tracking system, not as a small
  API-call wrapper.

## Related docs

- [Node SDK integration guide](../guides/integrating-the-node-sdk-in-a-node-app.md)
- [Web SDK integration guide](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Next.js SSR guide](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md)
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md)
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
- [Optimization Web SDK README](../../packages/web/web-sdk/README.md)
- [Optimization React Web SDK README](../../packages/web/frameworks/react-web-sdk/README.md)
- [Optimization Next.js SDK README](../../packages/web/frameworks/nextjs-sdk/README.md)
- [Node SSR + Web SDK reference implementation](../../implementations/node-sdk+web-sdk/README.md)
- [Next.js SDK SSR reference implementation](../../implementations/nextjs-sdk_ssr/README.md)
