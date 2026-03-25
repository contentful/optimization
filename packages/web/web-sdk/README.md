<p align="center">
  <a href="https://www.contentful.com/developers/docs/optimization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Optimization & Analytics</h1>

<h3 align="center">Optimization Web SDK</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

This SDK implements functionality specific to the Web environment, based on the
[Optimization Core Library](../../universal/core-sdk/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](../../../README.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
  - [Usage in Vanilla JS Web Pages](#usage-in-vanilla-js-web-pages)
- [Reference Implementations](#reference-implementations)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [Analytics Options](#analytics-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
  - [Optimization Options](#optimization-options)
  - [Persistence Behavior](#persistence-behavior)
- [Optimization Properties](#optimization-properties)
  - [Tracking (entry-interaction API)](#tracking-entry-interaction-api)
  - [`states` (`CoreStateful` observable state)](#states-corestateful-observable-state)
- [Optimization Methods](#optimization-methods)
  - [Top-level Methods](#top-level-methods)
    - [`consent`](#consent)
    - [`reset`](#reset)
    - [`flush`](#flush)
    - [`destroy`](#destroy)
    - [`tracking.enable`](#trackingenable)
    - [`tracking.disable`](#trackingdisable)
    - [`tracking.enableElement`](#trackingenableelement)
    - [`tracking.disableElement`](#trackingdisableelement)
    - [`tracking.clearElement`](#trackingclearelement)
  - [Optimization Data Resolution Methods](#optimization-data-resolution-methods)
    - [`getFlag`](#getflag)
    - [`resolveOptimizedEntry`](#resolveoptimizedentry)
    - [`getMergeTagValue`](#getmergetagvalue)
  - [Optimization and Analytics Event Methods](#optimization-and-analytics-event-methods)
    - [`identify`](#identify)
    - [`page`](#page)
    - [`screen`](#screen)
    - [`track`](#track)
    - [`trackView`](#trackview)
    - [`trackClick`](#trackclick)
    - [`trackHover`](#trackhover)
    - [`trackFlagView`](#trackflagview)
- [Entry Interaction Tracking](#entry-interaction-tracking)
  - [Entry View Tracking](#entry-view-tracking)
    - [Manual Entry View Tracking](#manual-entry-view-tracking)
    - [Automatic Entry View Tracking](#automatic-entry-view-tracking)
      - [View Detection Performance Notes](#view-detection-performance-notes)
  - [Entry Hover Tracking](#entry-hover-tracking)
    - [Hover Detection Performance Notes](#hover-detection-performance-notes)
  - [Entry Click Tracking](#entry-click-tracking)
    - [Click Detection Performance Notes](#click-detection-performance-notes)
  - [Manual Entry Element Observation](#manual-entry-element-observation)
  - [Automatic Entry Element Observation](#automatic-entry-element-observation)
- [Interceptors](#interceptors)
  - [Life-cycle Interceptors](#life-cycle-interceptors)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-web
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import ContentfulOptimization from '@contentful/optimization-web'
```

Configure and initialize the Optimization Web SDK:

```ts
const optimization = new ContentfulOptimization({ clientId: 'abc123' })
```

> [!IMPORTANT]
>
> Initialize the Web SDK once per page runtime. Reuse `window.contentfulOptimization` (or your own
> singleton container binding) instead of creating additional instances.

### Usage in Vanilla JS Web Pages

Alternatively, the Web SDK can be used directly within an HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/@contentful/optimization-web@latest/dist/contentful-optimization-web.umd.js"></script>
<script>
  new ContentfulOptimization({ clientId: 'abc123' })
  // is equal to:
  // window.contentfulOptimization = new ContentfulOptimization({ clientId: 'abc123' })
</script>
```

## Reference Implementations

- [Web Vanilla](../../../implementations/web-sdk/README.md): Example static Web page that renders
  and emits analytics events for optimized content using a vanilla JS drop-in build of the Web SDK

## Configuration

### Top-level Configuration Options

| Option                      | Required? | Default                                          | Description                                                                    |
| --------------------------- | --------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `allowedEventTypes`         | No        | `['identify', 'page']`                           | Allow-listed event types permitted when consent is not set                     |
| `analytics`                 | No        | See "Analytics Options"                          | Configuration specific to the Analytics/Insights API                           |
| `app`                       | No        | `undefined`                                      | The application definition used to attribute events to a specific consumer app |
| `autoTrackEntryInteraction` | No        | `{ views: false, clicks: false, hovers: false }` | Opt-in automated tracking of entry interactions (`views`, `clicks`, `hovers`)  |
| `clientId`                  | Yes       | N/A                                              | The Optimization API key                                                       |
| `cookie`                    | No        | `{ domain: undefined, expires: 365 }`            | Cookie configuration for anonymous ID persistence                              |
| `defaults`                  | No        | `undefined`                                      | Set of default state values applied on initialization                          |
| `environment`               | No        | `'main'`                                         | The environment identifier                                                     |
| `eventBuilder`              | No        | See "Event Builder Options"                      | Event builder configuration (channel/library metadata, etc.)                   |
| `fetchOptions`              | No        | See "Fetch Options"                              | Configuration for Fetch timeout and retry functionality                        |
| `getAnonymousId`            | No        | `undefined`                                      | Function used to obtain an anonymous user identifier                           |
| `logLevel`                  | No        | `'error'`                                        | Minimum log level for the default console sink                                 |
| `onEventBlocked`            | No        | `undefined`                                      | Callback invoked when an event call is blocked by guards                       |
| `optimization`              | No        | See "Optimization Options"                       | Configuration specific to the Optimization/Experience API                      |

Configuration method signatures:

- `cookie`:

  ```ts
  {
    domain?: string
    expires?: number
  }
  ```

- `getAnonymousId`: `() => string | undefined`
- `onEventBlocked`: `(event: BlockedEvent) => void`

### Analytics Options

| Option          | Required? | Default                                    | Description                                                              |
| --------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `baseUrl`       | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                            |
| `beaconHandler` | No        | Built-in beacon API integration            | Handler used to enqueue events via the Beacon API or a similar mechanism |

The following configuration options apply only in stateful environments:

| Option        | Required? | Default               | Description                                                     |
| ------------- | --------- | --------------------- | --------------------------------------------------------------- |
| `queuePolicy` | No        | See method signatures | Queue flush retry/backoff/circuit policy for stateful analytics |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`
- `queuePolicy`:

  ```ts
  {
    baseBackoffMs?: number,
    maxBackoffMs?: number,
    jitterRatio?: number,
    maxConsecutiveFailures?: number,
    circuitOpenMs?: number,
    onFlushFailure?: (context: QueueFlushFailureContext) => void,
    onCircuitOpen?: (context: QueueFlushFailureContext) => void,
    onFlushRecovered?: (context: QueueFlushRecoveredContext) => void
  }
  ```

  Supporting callback payloads:

  ```ts
  type QueueFlushFailureContext = {
    consecutiveFailures: number
    queuedBatches: number
    queuedEvents: number
    retryDelayMs: number
  }

  type QueueFlushRecoveredContext = {
    consecutiveFailures: number
  }
  ```

  Notes:
  - Invalid numeric values fall back to defaults.
  - `jitterRatio` is clamped to `[0, 1]`.
  - `maxBackoffMs` is normalized to be at least `baseBackoffMs`.
  - Failed flush attempts include both `false` responses and thrown send errors.

### Event Builder Options

Event builder options should only be supplied when building an SDK on top of Core or any of its
descendent SDKs.

| Option              | Required? | Default                                                      | Description                                                                        |
| ------------------- | --------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `app`               | No        | `undefined`                                                  | The application definition used to attribute events to a specific consumer app     |
| `channel`           | No        | `'web'`                                                      | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library`           | No        | `{ name: '@contentful/optimization-web', version: '0.0.0' }` | The client library metadata that is attached to all events                         |
| `getLocale`         | No        | Built-in locale resolution                                   | Function used to resolve the locale for outgoing events                            |
| `getPageProperties` | No        | Built-in page properties resolution                          | Function that returns the current page properties                                  |
| `getUserAgent`      | No        | Built-in user agent resolution                               | Function used to obtain the current user agent string when applicable              |

The `channel` option may contain one of the following values:

- `web`
- `mobile`
- `server`

Configuration method signatures:

- `getLocale`: `() => string | undefined`
- `getPageProperties`:

  ```ts
  () => {
    path: string,
    query: Record<string, string>,
    referrer: string,
    search: string,
    title?: string,
    url: string
  }
  ```

- `getUserAgent`: `() => string | undefined`

### Fetch Options

Fetch options allow for configuration of a Fetch API-compatible fetch method and the retry/timeout
logic integrated into the Optimization API Client. Specify the `fetchMethod` when the host
application environment does not offer a `fetch` method that is compatible with the standard Fetch
API in its global scope.

| Option             | Required? | Default     | Description                                                           |
| ------------------ | --------- | ----------- | --------------------------------------------------------------------- |
| `fetchMethod`      | No        | `undefined` | Signature of a fetch method used by the API clients                   |
| `intervalTimeout`  | No        | `0`         | Delay (in milliseconds) between retry attempts                        |
| `onFailedAttempt`  | No        | `undefined` | Callback invoked whenever a retry attempt fails                       |
| `onRequestTimeout` | No        | `undefined` | Callback invoked when a request exceeds the configured timeout        |
| `requestTimeout`   | No        | `3000`      | Maximum time (in milliseconds) to wait for a response before aborting |
| `retries`          | No        | `1`         | Maximum number of retry attempts                                      |

Configuration method signatures:

- `fetchMethod`: `(url: string | URL, init: RequestInit) => Promise<Response>`
- `onFailedAttempt` and `onRequestTimeout`: `(options: FetchMethodCallbackOptions) => void`

> [!NOTE]
>
> Web SDK fetch retry behavior intentionally matches the shared API Client contract: default retries
> apply only to HTTP `503` responses (`Service Unavailable`). This is deliberate and aligned with
> current Experience and Insights API expectations.

### Optimization Options

| Option            | Required? | Default                               | Description                                                         |
| ----------------- | --------- | ------------------------------------- | ------------------------------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                                     |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Enabled features which the API may use for each request             |
| `ip`              | No        | `undefined`                           | IP address to override the API behavior for IP analysis             |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used to translate `location.city` and `location.country`     |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints in plain text                  |
| `preflight`       | No        | `false`                               | Instructs the API to aggregate a new profile state but not store it |

The following configuration options apply only in stateful environments:

| Option        | Required? | Default               | Description                                                              |
| ------------- | --------- | --------------------- | ------------------------------------------------------------------------ |
| `queuePolicy` | No        | See method signatures | Queue and flush-retry policy for stateful optimization offline buffering |

Configuration method signatures:

- `queuePolicy`:

  ```ts
  {
    maxEvents?: number,
    onDrop?: (context: PersonalizationOfflineQueueDropContext) => void,
    flushPolicy?: {
      baseBackoffMs?: number,
      maxBackoffMs?: number,
      jitterRatio?: number,
      maxConsecutiveFailures?: number,
      circuitOpenMs?: number,
      onFlushFailure?: (context: QueueFlushFailureContext) => void,
      onCircuitOpen?: (context: QueueFlushFailureContext) => void,
      onFlushRecovered?: (context: QueueFlushRecoveredContext) => void
    }
  }
  ```

  Supporting callback payloads:

  ```ts
  type PersonalizationOfflineQueueDropContext = {
    droppedCount: number
    droppedEvents: ExperienceEventArray
    maxEvents: number
    queuedEvents: number
  }

  type QueueFlushFailureContext = {
    consecutiveFailures: number
    queuedBatches: number
    queuedEvents: number
    retryDelayMs: number
  }

  type QueueFlushRecoveredContext = {
    consecutiveFailures: number
  }
  ```

  Notes:
  - Default `maxEvents` is `100`.
  - If the queue is full while offline, oldest events are dropped first.
  - `onDrop` is best-effort; callback errors are swallowed.
  - `flushPolicy` uses the same normalization semantics as `analytics.queuePolicy`.

### Persistence Behavior

Web storage persistence is best-effort. If `localStorage` writes fail (for example due to quota or
access restrictions), the SDK continues operating with in-memory state and will retry persistence on
future writes.

## Optimization Properties

### Tracking (entry-interaction API)

`tracking` is a namespaced API for entry-interaction tracking controls.

Available methods:

- `enable(interaction, options?)`: Enable automatic tracking for an interaction
- `disable(interaction)`: Disable automatic tracking for an interaction
- `enableElement(interaction, element, options?)`: Force-enable tracking for one element
- `disableElement(interaction, element)`: Force-disable tracking for one element
- `clearElement(interaction, element)`: Remove a manual element override

Supported `interaction` values:

- `'views'`
- `'clicks'`
- `'hovers'`

Precedence behavior:

- `enable`/`disable` controls automatic tracking globally for the interaction.
- `enableElement` and `disableElement` take precedence for the specific element.
- `clearElement` removes the element-level override and restores automatic behavior.

Example: global tracking controls:

```ts
optimization.tracking.enable('views', { dwellTimeMs: 1500, minVisibleRatio: 0.25 })
optimization.tracking.disable('clicks')
optimization.tracking.enable('hovers', { dwellTimeMs: 1000, hoverDurationUpdateIntervalMs: 5000 })
```

Example: per-element override:

```ts
optimization.tracking.enableElement('views', element, { dwellTimeMs: 2000 })

// later
optimization.tracking.clearElement('views', element)
```

See [Entry View Tracking](#entry-view-tracking), [Entry Hover Tracking](#entry-hover-tracking), and
[Entry Click Tracking](#entry-click-tracking) for interaction-specific behavior and payload options.

### `states` (`CoreStateful` observable state)

`states` exposes signal-backed observables from the shared stateful Core runtime.

Available state streams:

- `consent`: Current consent state (`boolean | undefined`)
- `blockedEventStream`: Latest blocked-call metadata (`BlockedEvent | undefined`)
- `eventStream`: Latest emitted analytics/optimization event
  (`AnalyticsEvent | PersonalizationEvent | undefined`)
- `flag(name)`: Key-scoped flag observable (`Observable<Json>`)
- `canOptimize`: Whether optimization selections are available (`boolean`;
  `selectedOptimizations !== undefined`)
- `profile`: Current profile (`Profile | undefined`)
- `selectedOptimizations`: Current selected optimizations (`SelectedOptimizationArray | undefined`)
- `previewPanelAttached`: Preview panel attachment state (`boolean`)
- `previewPanelOpen`: Preview panel open state (`boolean`)

Each observable provides:

- `current`: Deep-cloned snapshot of the latest value
- `subscribe(next)`: Immediately emits `current`, then emits future updates
- `subscribeOnce(next)`: Emits the first non-nullish value, then auto-unsubscribes

`current` and callback payloads are deep-cloned snapshots, so local mutations do not affect SDK
internal state.

Update behavior:

- `blockedEventStream` updates whenever a call is blocked by consent guards.
- `eventStream` updates when a valid event is accepted for send/queue.
- `flag(name)` updates when the resolved value for that key changes.
- `canOptimize` updates whenever `selectedOptimizations` becomes defined or `undefined`.
- `consent` updates from defaults and `optimization.consent(...)`.
- `previewPanelAttached` and `previewPanelOpen` are controlled by preview tooling and are preserved
  across `reset()`.

Example: read synchronously from the latest snapshot:

```ts
const profile = optimization.states.profile.current
if (profile) console.log(`Current profile: ${profile.id}`)
```

Example: subscribe and clean up:

```ts
const sub = optimization.states.profile.subscribe((profile) => {
  if (!profile) return
  console.log(`Profile ${profile.id} updated`)
})

// later (component unmount / teardown)
sub.unsubscribe()
```

Example: wait for the first available profile:

```ts
optimization.states.profile.subscribeOnce((profile) => {
  console.log(`Profile ${profile.id} loaded`)
})
```

## Optimization Methods

Arguments marked with an asterisk (\*) are always required.

### Top-level Methods

#### `consent`

Updates the user consent state.

Arguments:

- `accept`: A boolean value specifying whether the user has accepted (`true`) or denied (`false`)

#### `reset`

Resets all internal state _except_ consent. This method expects no arguments and returns no value.

#### `flush`

Flushes queued analytics and optimization events. This method expects no arguments and returns a
`Promise<void>`.

#### `destroy`

Destroys the current SDK instance and releases runtime listeners/resources. This method is intended
for explicit teardown paths, such as tests or hot-reload workflows. It expects no arguments and
returns no value.

#### `tracking.enable`

Starts automatic tracking for a specific entry interaction.

Arguments:

- `interaction`: The interaction type to track (for example, `'views'`, `'clicks'`, or `'hovers'`)
- `options`: Interaction startup options to pass to the tracker

When `interaction` is `'views'`, supported options are:

- `dwellTimeMs`: Required time before emitting the view event; default 1,000ms
- `viewDurationUpdateIntervalMs`: Interval for periodic view-duration update events; default 5,000ms
- `minVisibleRatio`: Minimum intersection ratio considered "visible"; default `0.1` (10%)
- `root`: `IntersectionObserver` `root`; default `null` (viewport)
- `rootMargin`: `IntersectionObserver` `rootMargin`; default `0px`

When `interaction` is `'clicks'`, no additional startup options are currently supported.

When `interaction` is `'hovers'`, supported options are:

- `dwellTimeMs`: Required hover time before the first hover event; default 1,000ms
- `hoverDurationUpdateIntervalMs`: Interval for periodic hover-duration update events; default
  5,000ms

> [!WARNING]
>
> This method is called internally for auto-enabled interactions in `autoTrackEntryInteraction` when
> consent is given.

#### `tracking.disable`

Disables automatic tracking for a specific entry interaction.

Arguments:

- `interaction`: The interaction type to stop tracking (for example, `'views'`, `'clicks'`, or
  `'hovers'`)

This method returns no value. If force-enabled element overrides exist for that interaction, those
overrides can keep the detector active.

> [!WARNING]
>
> This method is called internally for auto-enabled interactions in `autoTrackEntryInteraction` when
> consent has not been given.

#### `tracking.enableElement`

Manually force-enables tracking for a specific element and interaction.

Arguments:

- `interaction`: The interaction type to track (for example, `'views'`, `'clicks'`, or `'hovers'`)
- `element`: A DOM element that directly contains the entry content to be tracked
- `options`: Optional per-element options
  - when `interaction` is `'views'`:
    - `data`: Entry-specific data used for payload extraction; see "Entry View Tracking"
    - `dwellTimeMs`: Per-element override of the required time before emitting the view event
  - when `interaction` is `'clicks'`:
    - `data`: Entry-specific data used for click payload extraction
  - when `interaction` is `'hovers'`:
    - `data`: Entry-specific data used for hover payload extraction; see "Entry Hover Tracking"
    - `dwellTimeMs`: Per-element override of the required time before emitting the first hover event
    - `hoverDurationUpdateIntervalMs`: Per-element override for periodic hover-duration updates

`enableElement` can be used even when automatic tracking for the interaction is disabled.

#### `tracking.disableElement`

Manually force-disables tracking for a specific element and interaction.

Arguments:

- `interaction`: The interaction type to disable (for example, `'views'`, `'clicks'`, or `'hovers'`)
- `element`: The target DOM element

`disableElement` takes precedence over automatic tracking for that element.

#### `tracking.clearElement`

Clears a manual element override for a specific interaction.

Arguments:

- `interaction`: The interaction type to clear (for example, `'views'`, `'clicks'`, or `'hovers'`)
- `element`: The target DOM element

After `clearElement`, the element falls back to automatic behavior for that interaction.

### Optimization Data Resolution Methods

#### `getFlag`

Get the specified Custom Flag's value from the provided changes array, or from the current internal
state.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

Behavior notes:

- Web SDK is stateful; calling `getFlag(...)` automatically emits a flag view event via
  `trackFlagView`.
- `states.flag(name)` also emits flag view events when read/subscribed.
- If full map resolution is needed for advanced use cases, use
  `optimization.flagsResolver.resolve(changes)`.

#### `resolveOptimizedEntry`

Resolve a baseline Contentful entry to a optimized variant using the provided selected
optimizations, or from the current internal state.

Type arguments:

- `S`: Entry skeleton type
- `M`: Chain modifiers
- `L`: Locale code

Arguments:

- `entry`\*: The entry to personalize
- `selectedOptimizations`: Selected optimizations

Returns:

- The resolved optimized entry variant, or the supplied baseline entry if baseline is the selected
  variant or a variant cannot be found.

#### `getMergeTagValue`

Resolve a "Merge Tag" to a value based on the current (or provided) profile. A "Merge Tag" is a
special Rich Text fragment supported by Contentful that specifies a profile data member to be
injected into the Rich Text when rendered.

Arguments:

- `embeddedNodeEntryTarget`\*: The merge tag entry node to resolve
- `profile`: The user profile

### Optimization and Analytics Event Methods

Only the following methods may return an `OptimizationData` object:

- `identify`
- `page`
- `screen`
- `track`
- `trackView` (when `payload.sticky` is `true`)

`trackClick`, `trackHover`, and `trackFlagView` return no data. When returned, `OptimizationData`
contains:

- `changes`: Currently used for Custom Flags
- `selectedOptimizations`: Selected optimizations for the profile
- `profile`: Profile associated with the evaluated events

#### `identify`

Identify the current profile/visitor to associate traits with a profile.

Arguments:

- `payload`\*: Identify event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `page`

Record a optimization page view.

Arguments:

- `payload`\*: Page view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `screen`

Record a optimization screen view.

Arguments:

- `payload`\*: Screen view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `track`

Record a optimization custom track event.

Arguments:

- `payload`\*: Track event builder arguments object, including an optional `profile` property with a
  `PartialProfile` value that requires only an `id`

#### `trackView`

Record an analytics component view event. When the payload marks the component as "sticky", an
additional optimization component view is recorded. This method only returns `OptimizationData` when
the component is marked as "sticky".

Arguments:

- `payload`\*: Component view event builder arguments object, including an optional `profile`
  property with a `PartialProfile` value that requires only an `id`

#### `trackClick`

Record an analytics component click event.

Returns:

- `void`

Arguments:

- `payload`\*: Component click event builder arguments object

#### `trackHover`

Record an analytics component hover event.

Returns:

- `void`

Arguments:

- `payload`\*: Component hover event builder arguments object

#### `trackFlagView`

Track a feature flag view via analytics. This is functionally the same as a non-sticky component
view event.

Returns:

- `void`

Arguments:

- `payload`\*: Component view event builder arguments object

## Entry Interaction Tracking

### Entry View Tracking

Tracking of entry/component views is based on the element that contains that entry's content. The
Optimization Web SDK can automatically track observed entry elements for events such as "component
views", "component hovers", and "component clicks", and it can also automatically observe elements
that are marked as entry-related elements.

Interaction observers are passive with respect to host event flow:

- They do not call `event.preventDefault()`.
- They do not call `event.stopPropagation()`.

#### Manual Entry View Tracking

To manually track entry views using custom tracking code, simply call `trackView` with the necessary
arguments when appropriate.

Example:

```ts
optimization.trackView({ componentId: 'abc-123', ... })
```

#### Automatic Entry View Tracking

Entry/component views can be tracked automatically for observed entry-related elements by simply
setting `autoTrackEntryInteraction.views` to `true`, or by calling the
`tracking.enable('views', ...)` method if further setup is required depending on the consumer's SDK
integration solution.

##### View Detection Performance Notes

View detection is based on `IntersectionObserver` plus dwell-time timers. The SDK tracks visibility
cycles, pauses/resumes timers on page visibility changes, and periodically sweeps disconnected
elements.

Different integration patterns can show different relative performance:

- A smaller set of observed elements is typically the most efficient path.
- Larger sets of concurrently observed elements increase intersection-processing and
  state-management work.
- Elements that frequently hover around `minVisibleRatio` can reset visibility cycles often, which
  increases timer churn and can delay view firing.
- Shorter `dwellTimeMs` can increase callback frequency when many elements become visible in short
  bursts.
- Frequent tab hide/show transitions add pause/resume work across active tracked elements.

In practice, callback and transport work (for example, `trackView` processing and event delivery)
often dominates overall cost once a view is detected.

For best runtime behavior, track only relevant elements, disable tracking for elements that are no
longer needed, and choose stable `minVisibleRatio` and `dwellTimeMs` values that match your UI
behavior.

### Entry Hover Tracking

Entry/component hovers can be tracked automatically for observed entry-related elements by setting
`autoTrackEntryInteraction.hovers` to `true`, or by calling `tracking.enable('hovers', ...)`.

A hover emits `component_hover` events after dwell-time threshold is reached, and can continue to
emit periodic duration updates while the same hover cycle remains active.

##### Hover Detection Performance Notes

Hover detection is based on pointer/mouse enter and leave events with dwell-time timers.

Different integration patterns can show different relative performance:

- A smaller set of observed elements is typically the most efficient path.
- Shorter `dwellTimeMs` can increase callback frequency in pointer-heavy UIs.
- Smaller `hoverDurationUpdateIntervalMs` values can increase periodic update event volume.
- Rapid pointer movement across dense interactive surfaces can increase hover-cycle churn.
- Frequent tab hide/show transitions add pause/resume work across active tracked elements.

For best runtime behavior, track only relevant elements and choose stable `dwellTimeMs` /
`hoverDurationUpdateIntervalMs` values that match expected user interaction patterns.

### Entry Click Tracking

Entry/component clicks can be tracked automatically for observed entry-related elements by setting
`autoTrackEntryInteraction.clicks` to `true`, or by calling `tracking.enable('clicks')`.

A click emits a `component_click` event only when one of the following is true:

- The entry element itself is clickable
- The entry has a clickable ancestor
- The click originates from a clickable descendant inside the entry

##### Click Detection Performance Notes

Click detection uses two complementary checks:

- A browser-native selector traversal (`Element.closest`) for semantic clickability (for example,
  links, buttons, form controls, role-based clickables, `[onclick]`, and
  `[data-ctfl-clickable="true"]`)
- A lightweight ancestor walk in SDK code to resolve the tracked entry element and to preserve
  support for `onclick` property handlers assigned in JavaScript

Different DOM shapes can show different relative performance:

- Clickable ancestor and non-clickable paths are typically the most improved, because native
  selector traversal can quickly determine whether a clickable selector exists in the ancestry.
- Entry-self-clickable and clickable-descendant paths are generally near parity, since both native
  clickability detection and tracked-entry resolution still run.
- `onclick` property-only paths (for example, `element.onclick = handler` with no matching clickable
  selector) rely on the SDK fallback walk and are usually the least optimized path.

For best runtime behavior, prefer semantic clickable elements (such as `<button>` or `<a href>`) or
explicit clickable hints (`[role="button"]`, `[data-ctfl-clickable="true"]`) over relying
exclusively on JavaScript-assigned `onclick` properties.

### Manual Entry Element Observation

To override tracking behavior for a specific element, use:

- `tracking.enableElement('views', element, options)` or
  `tracking.enableElement('clicks', element, options)` or
  `tracking.enableElement('hovers', element, options)` to force-enable tracking for that element
- `tracking.disableElement('views', element)` or `tracking.disableElement('clicks', element)` or
  `tracking.disableElement('hovers', element)` to force-disable tracking for that element
- `tracking.clearElement('views', element)` or `tracking.clearElement('clicks', element)` or
  `tracking.clearElement('hovers', element)` to remove a manual override and return to automatic
  behavior

Manual API overrides take precedence over data-attribute overrides (see below). After
`clearElement`, the element falls back to attribute overrides first, then normal automatic behavior.

The optional `data` option supports the following members:

- `entryId`\*: The ID of the content entry to be tracked; should be the selected variant if the
  entry is optimized
- `optimizationId`: The ID of the optimization/experience entry associated with the content entry;
  only required if the entry is optimized
- `sticky`: A boolean value that marks that the current user should _always_ see this variant;
  ignored if the entry is not optimized
- `variantIndex`: The index of the selected variant; only required if the entry is optimized

Example:

```ts
optimization.tracking.enableElement('views', element, {
  data: { entryId: 'abc-123', ... },
})
```

### Automatic Entry Element Observation

Elements that are associated to entries using the following data attributes will be automatically
detected for observation and entry-interaction tracking:

- `data-ctfl-entry-id`\*: The ID of the content entry to be tracked; should be the selected variant
  if the entry is optimized
- `data-ctfl-optimization-id`: The ID of the optimization/experience entry associated with the
  content entry; only required if the entry is optimized
- `data-ctfl-sticky`: A boolean value that marks that the current user should _always_ see this
  variant; ignored if the entry is not optimized
- `data-ctfl-variant-index`: The index of the selected variant; only required if the entry is
  optimized
- `data-ctfl-track-views`: Optional per-element override for view tracking (`true` = force-enable,
  `false` = force-disable)
- `data-ctfl-view-duration-update-interval-ms`: Optional per-element override for periodic
  view-duration updates (milliseconds)
- `data-ctfl-track-clicks`: Optional per-element override for click tracking (`true` = force-enable,
  `false` = force-disable)
- `data-ctfl-track-hovers`: Optional per-element override for hover tracking (`true` = force-enable,
  `false` = force-disable)
- `data-ctfl-hover-duration-update-interval-ms`: Optional per-element override for periodic
  hover-duration updates (milliseconds)

Example:

```html
<div data-ctfl-entry-id="abc-123">Entry Content</div>
```

## Interceptors

Interceptors may be used to read and/or modify data flowing through the Core SDK.

### Life-cycle Interceptors

- `event`: Intercepts an event's data _before_ it is queued and/or emitted
- `state`: Intercepts state data retrieved from an Experience API call _before_ updating the SDK's
  internal state

Example interceptor usage:

```ts
optimization.interceptors.event((event) => {
  event.properties.timestamp = new Date().toISOString()
})
```

> [!WARNING]
>
> Interceptors are intended to enable low-level interoperability; to simply read and react to
> Optimization SDK events, use the `states` observables.
