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
For profile handoff between server and browser, see
[Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md).

<details>
  <summary>Table of Contents</summary>

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
  - [React meta-framework SSR with React Web SDK tracking](#react-meta-framework-ssr-with-react-web-sdk-tracking)
- [Server-only interaction tracking](#server-only-interaction-tracking)
- [Manual browser tracking without the Web SDK](#manual-browser-tracking-without-the-web-sdk)
- [Stateless runtime constraints](#stateless-runtime-constraints)
- [Architecture choices](#architecture-choices)
- [Implementation checklist](#implementation-checklist)
- [Reference](#reference)

</details>

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

The Node SDK extends the stateless Core runtime. You can create one SDK instance per module or
process, but every event call must receive request-scoped inputs from the current request. The SDK
does not retain profile, consent, page, cookie, session, or browser-storage state between calls.

In practice, the application must supply:

- the current profile ID, usually from `ANONYMOUS_ID_COOKIE` (`ctfl-opt-aid`) or a session
- the consent decision, usually from an application-owned consent cookie, session, or user setting
- page context such as `path`, `url`, `referrer`, `query`, and locale
- user agent and optional IP override when server-side evaluation needs client request metadata
- the selected entry metadata needed for entry interaction events

The stateless methods are side-effecting API calls, not cacheable reads. Cache raw Contentful
delivery payloads and resolve them per request. Do not cache `page()`, `identify()`, `track()`,
`screen()`, `trackView()`, `trackClick()`, `trackHover()`, or `trackFlagView()` responses as if they
were pure data lookups.

## Event paths

Tracking uses two API paths with different semantics:

| Path           | Methods                                                                     | Purpose                                                        | Profile behavior                                                                             |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Experience API | `page()`, `identify()`, `screen()`, `track()`, sticky `trackView()`         | Evaluates or updates a profile and returns `OptimizationData`. | Uses `payload.profile?.id` in stateless Node calls. If absent, the API can create a profile. |
| Insights API   | non-sticky `trackView()`, `trackClick()`, `trackHover()`, `trackFlagView()` | Sends fire-and-forget Analytics interaction events.            | Requires a profile in stateless Node calls because there is no ambient SDK state.            |

Sticky entry views are the exception that touches both paths. In Node, `trackView({ sticky: true })`
sends a view event through Experience first, then sends the paired Insights event using the profile
returned by the Experience response. Non-sticky `trackView()` only uses Insights and therefore
requires `payload.profile.id`.

The interaction wire event types are:

| SDK method        | Wire type                                    | Common meaning                 |
| ----------------- | -------------------------------------------- | ------------------------------ |
| `trackView()`     | `component`                                  | Entry or Custom Flag exposure. |
| `trackClick()`    | `component_click`                            | Entry click.                   |
| `trackHover()`    | `component_hover`                            | Entry hover.                   |
| `trackFlagView()` | `component` with `componentType: 'Variable'` | Custom Flag exposure.          |

## Server-side tracking capabilities

Use the Node SDK for events that the server can state truthfully.

Server-side `page()` is the normal SSR entry point. It records the page request, returns
`OptimizationData`, and gives the server `profile`, `selectedOptimizations`, and `changes` for the
render.

```ts
const pageResponse = await optimization.page(
  {
    profile: profileId ? { id: profileId } : undefined,
    page: {
      path: req.path,
      query,
      referrer: req.get('referer') ?? '',
      search: url.search,
      url: url.toString(),
    },
    userAgent: req.get('user-agent') ?? 'node-server',
  },
  { locale: req.acceptsLanguages()[0] ?? 'en-US' },
)
```

Use server-side `track()` for server-known business events:

```ts
await optimization.track(
  {
    profile: pageResponse.profile,
    event: 'quote_requested',
    properties: {
      plan: 'enterprise',
      source: 'pricing-page',
    },
  },
  requestOptions,
)
```

Use server-side `trackView()` only when the event definition is "the server rendered this entry into
the response", not "the user saw this entry in the viewport". If the business meaning requires real
visibility, use browser tracking.

```ts
import { randomUUID } from 'node:crypto'

await optimization.trackView(
  {
    profile: pageResponse.profile,
    componentId: resolvedEntry.sys.id,
    experienceId: selectedOptimization?.experienceId,
    variantIndex: selectedOptimization?.variantIndex,
    viewDurationMs: 0,
    viewId: randomUUID(),
  },
  requestOptions,
)
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

For each rendered entry, put the resolved entry ID on the element that represents the visible
Contentful entry. When the entry came from an optimization, include the selected optimization
metadata.

```html
<article
  data-ctfl-entry-id="resolved-entry-id"
  data-ctfl-optimization-id="experience-id"
  data-ctfl-sticky="true"
  data-ctfl-variant-index="1"
>
  ...
</article>
```

`data-ctfl-entry-id` is required for automatic tracking. The other attributes are optional and
belong only on optimized entries:

| Attribute                   | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `data-ctfl-entry-id`        | Resolved Contentful entry ID used as `componentId`.             |
| `data-ctfl-optimization-id` | Experience ID used as `experienceId`.                           |
| `data-ctfl-sticky`          | `true` when the selected optimization marks the view as sticky. |
| `data-ctfl-variant-index`   | Selected variant index.                                         |
| `data-ctfl-track-views`     | Per-element view tracking override.                             |
| `data-ctfl-track-clicks`    | Per-element click tracking override.                            |
| `data-ctfl-track-hovers`    | Per-element hover tracking override.                            |
| `data-ctfl-clickable`       | Marks a non-semantic descendant or wrapper as clickable.        |

If the server also needs a stable baseline ID for later browser rerenders, use a separate
application-owned attribute such as `data-ctfl-baseline-id`. The tracking payload uses the resolved
entry ID.

### Initialize the Web SDK without client-side personalization

This browser code enables tracking but does not fetch entries or resolve variants:

```html
<script src="/dist/contentful-optimization-web.umd.js"></script>
<script>
  const optimization = new ContentfulOptimization({
    clientId: window.__OPTIMIZATION_CONFIG__.clientId,
    environment: window.__OPTIMIZATION_CONFIG__.environment,
    app: { name: document.title, version: '1.0.0' },
    defaults: {
      consent: window.__OPTIMIZATION_CONSENT__,
      profile: window.__OPTIMIZATION_DATA__?.profile,
    },
    autoTrackEntryInteraction: {
      views: true,
      clicks: true,
      hovers: false,
    },
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

- **Bootstrap the server profile.** Serialize the `profile` returned by the server's `page()` or
  `identify()` call and pass it as `defaults.profile`. Use this when the same server response
  already rendered personalized HTML from that profile.
- **Re-evaluate in the browser.** Persist `ctfl-opt-aid` on the server, initialize the Web SDK in
  the browser, call `page()` after your consent policy allows it, then enable tracking after the
  page response populates browser profile state.
- **Use a first-party collection endpoint.** If you do not want the browser to hold the full
  profile, custom browser code can send interaction observations to your server, and the server can
  call the Node SDK with the request's profile ID. This is a manual tracking architecture, not the
  Web SDK auto-tracking path.

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

### React meta-framework SSR with React Web SDK tracking

The
[Next.js SSR + React Web SDK reference implementation](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/README.md)
is one concrete example of the same tracking-only browser pattern. The guidance applies to any
React-based meta-framework that can render React code on the server and hydrate part of that tree in
the browser.

Keep personalization server-owned by enforcing these boundaries:

- Server-only modules, routes, loaders, middleware, actions, or Server Components import
  `@contentful/optimization-node`, call `sdk.page()`, call `sdk.resolveOptimizedEntry(...)`, and
  render plain React elements.
- Server-rendered entry wrappers include `data-ctfl-entry-id` and `data-ctfl-baseline-id`, so the
  browser tracking runtime can observe them after hydration.
- Client-only modules import `@contentful/optimization-react-web` for `OptimizationRoot`, router
  page tracking, consent controls, identify controls, and automatic interaction tracking.
- `OptimizationRoot` and router page trackers are loaded behind the framework's client-only
  boundary, so the browser Web SDK is not instantiated during SSR. In Next.js, the reference
  implementation uses `next/dynamic` with `ssr: false`; other frameworks need the equivalent
  client-only island, lazy hydration, or browser-only wrapper.
- The client tree does not use `OptimizedEntry`, `useOptimizedEntry`, or browser-side
  `resolveOptimizedEntry()`.
- The client SDK is not initialized with `defaults.selectedOptimizations`, so browser state cannot
  re-resolve the already rendered entries.

This split avoids the common accidental-client-personalization path in React apps. `OptimizedEntry`
is the React Web SDK's browser-personalization component; using it in a hydrated client tree can
cause the browser to resolve variants from client SDK state. For server-only personalization, render
the resolved entry in the server-owned render path and use React Web SDK only for tracking and
controls.

After hydration, client actions can still update the profile. For example, `sdk.identify()` can
associate the visitor with a known user, and `sdk.consent(true)` can allow interaction tracking.
Those actions do not change the already rendered HTML in the reference pattern. The user sees
updated personalization on the next server request, such as a refresh or full navigation, when the
Node SDK evaluates the updated profile and renders a new response.

The exact framework primitive is less important than the ownership boundary. If a framework can run
the same React module on both the server and the browser, do not put personalization and tracking
concerns in that shared module. Keep Node SDK calls in server-only code, keep React Web SDK calls in
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

## Reference

- [Node SDK integration guide](../guides/integrating-the-node-sdk-in-a-node-app.md)
- [Web SDK integration guide](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
- [Node SSR + Web SDK reference implementation](../../implementations/node-sdk+web-sdk/README.md)
- [Next.js SSR + React Web SDK reference implementation](../../implementations/react-web-sdk+node-sdk_nextjs-ssr/README.md)
- [Node stateless runtime source](../../packages/universal/core-sdk/src/CoreStateless.ts)
- [Web SDK tracking runtime source](../../packages/web/web-sdk/src/entry-tracking/EntryInteractionRuntime.ts)
- [Web SDK tracking payload source](../../packages/web/web-sdk/src/entry-tracking/resolveTrackingPayload.ts)
