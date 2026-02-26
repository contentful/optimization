<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Web SDK</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

This SDK implements functionality specific to the Web environment, based on the
[Optimization Core Library](/universal/core/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](/README.md).

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
  - [Personalization Options](#personalization-options)
  - [Persistence Behavior](#persistence-behavior)
- [Optimization Properties](#optimization-properties)
- [Optimization Methods](#optimization-methods)
  - [Top-level Methods](#top-level-methods)
    - [`consent`](#consent)
    - [`reset`](#reset)
    - [`flush`](#flush)
    - [`destroy`](#destroy)
    - [`tracking.enable`](#trackingenable)
    - [`tracking.disable`](#trackingdisable)
    - [`tracking.observe`](#trackingobserve)
    - [`tracking.unobserve`](#trackingunobserve)
  - [Personalization Data Resolution Methods](#personalization-data-resolution-methods)
    - [`getCustomFlag`](#getcustomflag)
    - [`personalizeEntry`](#personalizeentry)
    - [`getMergeTagValue`](#getmergetagvalue)
  - [Personalization and Analytics Event Methods](#personalization-and-analytics-event-methods)
    - [`identify`](#identify)
    - [`page`](#page)
    - [`screen`](#screen)
    - [`track`](#track)
    - [`trackComponentView`](#trackcomponentview)
    - [`trackComponentClick`](#trackcomponentclick)
    - [`trackFlagView`](#trackflagview)
- [Entry View Tracking](#entry-view-tracking)
  - [Manual Entry View Tracking](#manual-entry-view-tracking)
  - [Automatic Entry View Tracking](#automatic-entry-view-tracking)
  - [Entry Click Tracking](#entry-click-tracking)
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
import Optimization from '@contentful/optimization-web'
```

Configure and initialize the Optimization Web SDK:

```ts
const optimization = new Optimization({ clientId: 'abc123' })
```

> [!IMPORTANT]
>
> Initialize the Web SDK once per page runtime. Reuse `window.optimization` (or your own singleton
> container binding) instead of creating additional instances.

### Usage in Vanilla JS Web Pages

Alternatively, the Web SDK can be used directly within an HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/@contentful/optimization-web@latest/dist/contentful-optimization-web.umd.js"></script>
<script>
  new Optimization({ clientId: 'abc123' })
  // is equal to:
  // window.optimization = new Optimization({ clientId: 'abc123' })
</script>
```

## Reference Implementations

- [Web Vanilla](/implementations/web-vanilla/README.md): Example static Web page that renders and
  emits analytics events for personalized content using a vanilla JS drop-in build of the Web SDK

## Configuration

### Top-level Configuration Options

| Option                      | Required? | Default                               | Description                                                                    |
| --------------------------- | --------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `allowedEventTypes`         | No        | `['identify', 'page']`                | Allow-listed event types permitted when consent is not set                     |
| `analytics`                 | No        | See "Analytics Options"               | Configuration specific to the Analytics/Insights API                           |
| `app`                       | No        | `undefined`                           | The application definition used to attribute events to a specific consumer app |
| `autoTrackEntryInteraction` | No        | `{ views: false, clicks: false }`     | Opt-in automated tracking of entry interactions (`views`, `clicks`)            |
| `clientId`                  | Yes       | N/A                                   | The Optimization API key                                                       |
| `cookie`                    | No        | `{ domain: undefined, expires: 365 }` | Cookie configuration for anonymous ID persistence                              |
| `defaults`                  | No        | `undefined`                           | Set of default state values applied on initialization                          |
| `environment`               | No        | `'main'`                              | The environment identifier                                                     |
| `eventBuilder`              | No        | See "Event Builder Options"           | Event builder configuration (channel/library metadata, etc.)                   |
| `fetchOptions`              | No        | See "Fetch Options"                   | Configuration for Fetch timeout and retry functionality                        |
| `getAnonymousId`            | No        | `undefined`                           | Function used to obtain an anonymous user identifier                           |
| `logLevel`                  | No        | `'error'`                             | Minimum log level for the default console sink                                 |
| `onEventBlocked`            | No        | `undefined`                           | Callback invoked when an event call is blocked by guards                       |
| `personalization`           | No        | See "Personalization Options"         | Configuration specific to the Personalization/Experience API                   |

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

| Option              | Required? | Default                                              | Description                                                                        |
| ------------------- | --------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `app`               | No        | `undefined`                                          | The application definition used to attribute events to a specific consumer app     |
| `channel`           | No        | `'web'`                                              | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library`           | No        | `{ name: 'Optimization Web SDK', version: '0.0.0' }` | The client library metadata that is attached to all events                         |
| `getLocale`         | No        | Built-in locale resolution                           | Function used to resolve the locale for outgoing events                            |
| `getPageProperties` | No        | Built-in page properties resolution                  | Function that returns the current page properties                                  |
| `getUserAgent`      | No        | Built-in user agent resolution                       | Function used to obtain the current user agent string when applicable              |

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

### Personalization Options

| Option            | Required? | Default                               | Description                                                         |
| ----------------- | --------- | ------------------------------------- | ------------------------------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                                     |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Enabled features which the API may use for each request             |
| `ip`              | No        | `undefined`                           | IP address to override the API behavior for IP analysis             |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used to translate `location.city` and `location.country`     |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints in plain text                  |
| `preflight`       | No        | `false`                               | Instructs the API to aggregate a new profile state but not store it |

The following configuration options apply only in stateful environments:

| Option        | Required? | Default               | Description                                                                 |
| ------------- | --------- | --------------------- | --------------------------------------------------------------------------- |
| `queuePolicy` | No        | See method signatures | Queue and flush-retry policy for stateful personalization offline buffering |

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

- `states`: Returns an object mapping of observables for all internal states
- `tracking`: Namespaced entry-interaction tracking API with `enable`, `disable`, `observe`, and
  `unobserve`

The following observables are exposed via the `states` property:

- `consent`: The current state of user consent
- `blockedEventStream`: The latest blocked event payload
- `eventStream`: The latest event to be queued
- `flags`: All current resolved Custom Flags
- `profile`: The current user profile
- `personalizations`: The current collection of selected personalizations

The `blockedEventStream` state is updated whenever a call is blocked by consent guards. Each state
except `consent`, `eventStream`, and `blockedEventStream` is updated internally whenever a response
from the Experience API contains a new or updated respective state.

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

Flushes queued analytics and personalization events. This method expects no arguments and returns a
`Promise<void>`.

#### `destroy`

Destroys the current SDK instance and releases runtime listeners/resources. This method is intended
for explicit teardown paths, such as tests or hot-reload workflows. It expects no arguments and
returns no value.

#### `tracking.enable`

Starts automatic tracking for a specific entry interaction.

Arguments:

- `interaction`: The interaction type to track (for example, `'views'` or `'clicks'`)
- `options`: Interaction startup options to pass to the tracker

When `interaction` is `'views'`, supported options are:

- `dwellTimeMs`: Required time before emitting the view event; default 1,000ms
- `minVisibleRatio`: Minimum intersection ratio considered "visible"; default `0.1` (10%)
- `root`: `IntersectionObserver` `root`; default `null` (viewport)
- `rootMargin`: `IntersectionObserver` `rootMargin`; default `0px`

When `interaction` is `'clicks'`, no additional startup options are currently supported.

> [!WARNING]
>
> This method is called internally for auto-enabled interactions in `autoTrackEntryInteraction` when
> consent is given.

#### `tracking.disable`

Stops and cleans up automatic tracking for a specific entry interaction.

Arguments:

- `interaction`: The interaction type to stop tracking (for example, `'views'` or `'clicks'`)

This method returns no value.

> [!WARNING]
>
> This method is called internally for auto-enabled interactions in `autoTrackEntryInteraction` when
> consent has not been given.

#### `tracking.observe`

Manually observes a given element for a specific entry interaction.

Arguments:

- `interaction`: The interaction type to track (for example, `'views'` or `'clicks'`)
- `element`: A DOM element that directly contains the entry content to be tracked
- `options`\*: Per-element options used to refine observation
  - when `interaction` is `'views'`:
    - `data`: Entry-specific data to send to the `IntersectionObserver` callback; see "Entry View
      Tracking"
    - `dwellTimeMs`: Per-element override of the required time before emitting the view event
  - when `interaction` is `'clicks'`:
    - `data`: Entry-specific data for click payload extraction; same shape as view-tracking data

> [!INFO]
>
> This method does not need to be called if the given element is auto-observable as an entry; see
> "Entry View Tracking"

#### `tracking.unobserve`

Manually stops observing a given element for a specific entry interaction.

Arguments:

- `interaction`: The interaction type to stop tracking (for example, `'views'` or `'clicks'`)
- `element`: A DOM element that directly contains entry content that is already tracked

> [!INFO]
>
> This method does not need to be called if the given element is auto-observable as an entry; see
> "Entry View Tracking"

### Personalization Data Resolution Methods

#### `getCustomFlag`

Get the specified Custom Flag's value from the provided changes array, or from the current internal
state.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

#### `personalizeEntry`

Resolve a baseline Contentful entry to a personalized variant using the provided selected
personalizations, or from the current internal state.

Type arguments:

- `S`: Entry skeleton type
- `M`: Chain modifiers
- `L`: Locale code

Arguments:

- `entry`\*: The entry to personalize
- `personalizations`: Selected personalizations

Returns:

- The resolved personalized entry variant, or the supplied baseline entry if baseline is the
  selected variant or a variant cannot be found.

#### `getMergeTagValue`

Resolve a "Merge Tag" to a value based on the current (or provided) profile. A "Merge Tag" is a
special Rich Text fragment supported by Contentful that specifies a profile data member to be
injected into the Rich Text when rendered.

Arguments:

- `embeddedNodeEntryTarget`\*: The merge tag entry node to resolve
- `profile`: The user profile

### Personalization and Analytics Event Methods

Only the following methods may return an `OptimizationData` object:

- `identify`
- `page`
- `screen`
- `track`
- `trackComponentView` (when `payload.sticky` is `true`)

`trackComponentClick` and `trackFlagView` return no data. When returned, `OptimizationData`
contains:

- `changes`: Currently used for Custom Flags
- `personalizations`: Selected personalizations for the profile
- `profile`: Profile associated with the evaluated events

#### `identify`

Identify the current profile/visitor to associate traits with a profile.

Arguments:

- `payload`\*: Identify event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `page`

Record a personalization page view.

Arguments:

- `payload`\*: Page view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `screen`

Record a personalization screen view.

Arguments:

- `payload`\*: Screen view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `track`

Record a personalization custom track event.

Arguments:

- `payload`\*: Track event builder arguments object, including an optional `profile` property with a
  `PartialProfile` value that requires only an `id`

#### `trackComponentView`

Record an analytics component view event. When the payload marks the component as "sticky", an
additional personalization component view is recorded. This method only returns `OptimizationData`
when the component is marked as "sticky".

Arguments:

- `payload`\*: Component view event builder arguments object, including an optional `profile`
  property with a `PartialProfile` value that requires only an `id`

#### `trackComponentClick`

Record an analytics component click event.

Returns:

- `void`

Arguments:

- `payload`\*: Component click event builder arguments object

#### `trackFlagView`

Track a feature flag view via analytics. This is functionally the same as a non-sticky component
view event.

Returns:

- `void`

Arguments:

- `payload`\*: Component view event builder arguments object

## Entry View Tracking

Tracking of entry/component views is based on the element that contains that entry's content. The
Optimization Web SDK can automatically track observed entry elements for events such as "component
views" and "component clicks", and it can also automatically observe elements that are marked as
entry-related elements.

### Manual Entry View Tracking

To manually track entry views using custom tracking code, simply call `trackComponentView` with the
necessary arguments when appropriate.

Example:

```ts
optimization.trackComponentView({ componentId: 'abc-123', ... })
```

### Automatic Entry View Tracking

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

In practice, callback and transport work (for example, `trackComponentView` processing and event
delivery) often dominates overall cost once a view is detected.

For best runtime behavior, observe only relevant elements, unobserve elements that are no longer
needed, and choose stable `minVisibleRatio` and `dwellTimeMs` values that match your UI behavior.

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

To track an element as an entry-related element, call the `tracking.observe('views', ...)` or
`tracking.observe('clicks', ...)` method with the element to be tracked. The optional `data` option
supports the following members:

- `entryId`\*: The ID of the content entry to be tracked; should be the selected variant if the
  entry is personalized
- `personalizationId`: The ID of the personalization/experience entry associated with the content
  entry; only required if the entry is personalized
- `sticky`: A boolean value that marks that the current user should _always_ see this variant;
  ignored if the entry is not personalized
- `variantIndex`: The index of the selected variant; only required if the entry is personalized

Example:

```ts
optimization.tracking.observe('views', element, {
  data: { entryId: 'abc-123', ... },
})
```

### Automatic Entry Element Observation

Elements that are associated to entries using the following data attributes will be automatically
detected for observation and entry-interaction tracking:

- `data-ctfl-entry-id`\*: The ID of the content entry to be tracked; should be the selected variant
  if the entry is personalized
- `data-ctfl-personalization-id`: The ID of the personalization/experience entry associated with the
  content entry; only required if the entry is personalized
- `data-ctfl-sticky`: A boolean value that marks that the current user should _always_ see this
  variant; ignored if the entry is not personalized
- `data-ctfl-variant-index`: The index of the selected variant; only required if the entry is
  personalized

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
