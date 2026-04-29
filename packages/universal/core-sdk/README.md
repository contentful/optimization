<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Optimization Core SDK</h1>

<h3 align="center">Optimization Core SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Optimization Core SDK encapsulates all platform-agnostic functionality and business logic. All
other SDKs descend from the Core SDK.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Working with Stateless Core](#working-with-stateless-core)
- [Working with Stateful Core](#working-with-stateful-core)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [API Options](#api-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
  - [Queue Policy Options](#queue-policy-options)
- [Core Methods](#core-methods)
  - [Optimization Data Resolution Methods](#optimization-data-resolution-methods)
    - [`getFlag`](#getflag)
    - [`resolveOptimizedEntry`](#resolveoptimizedentry)
    - [`getMergeTagValue`](#getmergetagvalue)
  - [Event Methods](#event-methods)
    - [`identify`](#identify)
    - [`page`](#page)
    - [`screen`](#screen)
    - [`track`](#track)
    - [`trackView`](#trackview)
    - [`trackClick`](#trackclick)
    - [`trackHover`](#trackhover)
    - [`trackFlagView`](#trackflagview)
- [Stateful-only Core Methods](#stateful-only-core-methods)
  - [`consent`](#consent)
  - [`reset`](#reset)
  - [`flush`](#flush)
  - [`destroy`](#destroy)
- [Core States (`CoreStateful` only)](#core-states-corestateful-only)
- [Interceptors](#interceptors)
  - [Life-cycle Interceptors](#life-cycle-interceptors)
- [Preview support (internal)](#preview-support-internal)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-core
```

Import either the stateful or stateless Core class, depending on the target environment; both CJS
and ESM module systems are supported, ESM preferred:

```ts
import { CoreStateful } from '@contentful/optimization-core'
// or
import { CoreStateless } from '@contentful/optimization-core'
```

Configure and initialize the Core SDK:

```ts
const statefulOptimization = new CoreStateful({ clientId: 'abc123' })
const statelessOptimization = new CoreStateless({ clientId: 'abc123' })
const requestOptions = { locale: 'de-DE' }

await statelessOptimization.page({}, requestOptions)
```

## Working with Stateless Core

The `CoreStateless` class is intended to be used as the basis for SDKs that would run in stateless
environments such as Node-based servers and server-side functions in meta-frameworks such as
Next.js.

In stateless environments, Core will not maintain any internal state, which includes user consent.
These concerns should be handled by consumers to fit their specific architectural and design
specifications.

Request-scoped Experience options in `CoreStateless` are passed as the final argument to each
stateless event method.

## Working with Stateful Core

The `CoreStateful` class is intended to be used as the basis for SDKs that would run in stateful
environments such as Web front-ends and mobile applications (via JavaScript runtime containers).

In stateful environments, Core maintains state internally for consent, an event stream, and
profile-related data that is commonly obtained from requests to the Experience API. These states are
exposed externally as read-only observables.

> [!IMPORTANT]
>
> `CoreStateful` uses module-global state by design. Initialize exactly one stateful instance per
> JavaScript runtime and reuse it.

## Configuration

### Top-level Configuration Options

| Option         | Required? | Default                     | Description                                                             |
| -------------- | --------- | --------------------------- | ----------------------------------------------------------------------- |
| `api`          | No        | See "API Options"           | Unified configuration for the Experience API and Insights API endpoints |
| `clientId`     | Yes       | N/A                         | Shared API key for Experience API and Insights API requests             |
| `environment`  | No        | `'main'`                    | The environment identifier                                              |
| `eventBuilder` | No        | See "Event Builder Options" | Event builder configuration (channel/library metadata, etc.)            |
| `fetchOptions` | No        | See "Fetch Options"         | Configuration for Fetch timeout and retry functionality                 |
| `logLevel`     | No        | `'error'`                   | Minimum log level for the default console sink                          |

The following configuration options apply only in stateful environments:

| Option              | Required? | Default                          | Description                                                |
| ------------------- | --------- | -------------------------------- | ---------------------------------------------------------- |
| `allowedEventTypes` | No        | `['identify', 'page', 'screen']` | Allow-listed event types permitted when consent is not set |
| `defaults`          | No        | `undefined`                      | Set of default state values applied on initialization      |
| `getAnonymousId`    | No        | `undefined`                      | Function used to obtain an anonymous user identifier       |
| `onEventBlocked`    | No        | `undefined`                      | Callback invoked when an event call is blocked by guards   |
| `queuePolicy`       | No        | See "Queue Policy Options"       | Shared queue and retry configuration for stateful delivery |

Configuration method signatures:

- `getAnonymousId`: `() => string | undefined`
- `onEventBlocked`: `(event: BlockedEvent) => void`

### API Options

| Option              | Required? | Default                                    | Description                                                  |
| ------------------- | --------- | ------------------------------------------ | ------------------------------------------------------------ |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                              |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Enabled features the Experience API may use for each request |

The following configuration option applies only in stateful environments:

| Option          | Required? | Default     | Description                                                                    |
| --------------- | --------- | ----------- | ------------------------------------------------------------------------------ |
| `beaconHandler` | No        | `undefined` | Handler used to enqueue Insights API events via the Beacon API or equivalent   |
| `ip`            | No        | `undefined` | IP address override used by the Experience API for location analysis           |
| `locale`        | No        | `'en-US'`   | Locale used to translate `location.city` and `location.country`                |
| `plainText`     | No        | `false`     | Sends performance-critical Experience API endpoints in plain text              |
| `preflight`     | No        | `false`     | Instructs the Experience API to aggregate a new profile state but not store it |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`

In stateless environments, pass `ip`, `locale`, `plainText`, and `preflight` as the final argument
to stateless event methods instead of constructor config.

### Queue Policy Options

`queuePolicy` is available only in `CoreStateful` and combines shared flush retry settings with
Experience API offline buffering controls.

Configuration shape:

```ts
{
  flush?: {
    baseBackoffMs?: number,
    maxBackoffMs?: number,
    jitterRatio?: number,
    maxConsecutiveFailures?: number,
    circuitOpenMs?: number,
    onFlushFailure?: (context: QueueFlushFailureContext) => void,
    onCircuitOpen?: (context: QueueFlushFailureContext) => void,
    onFlushRecovered?: (context: QueueFlushRecoveredContext) => void
  },
  offlineMaxEvents?: number,
  onOfflineDrop?: (context: ExperienceQueueDropContext) => void
}
```

Supporting callback payloads:

```ts
type ExperienceQueueDropContext = {
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

- `flush` applies the same retry/backoff/circuit policy to both Insights API flushing and Experience
  API offline replay.
- Invalid numeric values fall back to defaults.
- `jitterRatio` is clamped to `[0, 1]`.
- `maxBackoffMs` is normalized to be at least `baseBackoffMs`.
- Failed flush attempts include both `false` responses and thrown send errors.

### Event Builder Options

Event builder options should only be supplied when building an SDK on top of Core or any of its
descendent SDKs.

| Option    | Required? | Default     | Description                                                                        |
| --------- | --------- | ----------- | ---------------------------------------------------------------------------------- |
| `app`     | No        | `undefined` | The application definition used to attribute events to a specific consumer app     |
| `channel` | Yes       | N/A         | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library` | Yes       | N/A         | The client library metadata that is attached to all events                         |

The `channel` option may contain one of the following values:

- `web`
- `mobile`
- `server`

The following configuration options apply only in stateful environments:

| Option              | Required? | Default                         | Description                                                           |
| ------------------- | --------- | ------------------------------- | --------------------------------------------------------------------- |
| `getLocale`         | No        | `() => 'en-US'`                 | Function used to resolve the locale for outgoing events               |
| `getPageProperties` | No        | `() => DEFAULT_PAGE_PROPERTIES` | Function that returns the current page properties                     |
| `getUserAgent`      | No        | `() => undefined`               | Function used to obtain the current user agent string when applicable |

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
logic integrated into the SDK's bundled API clients. Specify the `fetchMethod` when the host
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
> Core inherits the API Client retry contract: default retries intentionally apply only to HTTP
> `503` responses (`Service Unavailable`). This is deliberate and aligned with current Experience
> API and Insights API expectations; do not broaden retry status handling without an explicit API
> contract change.

## Core Methods

The methods in this section are available in both stateful and stateless Core classes. However, be
aware that there are some minor differences in argument usage between stateful and stateless Core
implementations.

Arguments marked with an asterisk (\*) are always required.

### Optimization Data Resolution Methods

#### `getFlag`

Get the specified Custom Flag's value from the provided changes array, or from the current internal
state in stateful implementations.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

Behavior notes:

- In `CoreStateful`, calling `getFlag(...)` automatically emits a flag view event via
  `trackFlagView`.
- In `CoreStateless`, `getFlag(...)` does not auto-emit a flag view event.
- If full map resolution is needed for advanced use cases, use
  `optimization.flagsResolver.resolve(changes)`.

> [!NOTE]
>
> If the `changes` argument is omitted in stateless implementations, the method will return
> `undefined`.

#### `resolveOptimizedEntry`

Resolve a baseline Contentful entry to an optimized variant using the provided selected
optimizations, or from the current internal state in stateful implementations.

Type arguments:

- `S`: Entry skeleton type
- `M`: Chain modifiers
- `L`: Locale code

Arguments:

- `entry`\*: The baseline entry to resolve
- `selectedOptimizations`: Selected optimizations

Returns:

- The resolved optimized entry variant, or the supplied baseline entry if baseline is the selected
  variant or a variant cannot be found.

> [!NOTE]
>
> If the `selectedOptimizations` argument is omitted in stateless implementations, the method will
> return the baseline entry.

#### `getMergeTagValue`

Resolve a "Merge Tag" to a value based on the current (or provided) profile. A "Merge Tag" is a
special Rich Text fragment supported by Contentful that specifies a profile data member to be
injected into the Rich Text when rendered.

Arguments:

- `embeddedNodeEntryTarget`\*: The merge tag entry node to resolve
- `profile`: The user profile

> [!NOTE]
>
> If the `profile` argument is omitted in stateless implementations, the method will return the
> merge tag's fallback value.

### Event Methods

In `CoreStateful`, call these methods on the root instance. In `CoreStateless`, call them on the
root instance and pass request-scoped Experience options as the final argument when needed:

```ts
const requestOptions = {
  locale: 'de-DE',
}

await optimization.page({ ...requestContext, profile }, requestOptions)
```

Request-scoped Experience options stay separate from the event payload. Event context data belongs
in `payload`, while `ip`, `locale`, `plainText`, and `preflight` belong in `requestOptions`.

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

In stateless runtimes, Insights-backed methods require a profile for delivery. Non-sticky
`trackView`, `trackClick`, `trackHover`, and `trackFlagView` require `payload.profile.id`. Sticky
`trackView` may omit `profile`, because the returned Experience profile is reused for the paired
Insights event.

#### `identify`

Identify the current profile/visitor to associate traits with a profile.

Arguments:

- `payload`\*: Identify event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options passed as the final argument

#### `page`

Record an Experience API page view.

Arguments:

- `payload`\*: Page view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options passed as the final argument

#### `screen`

Record an Experience API screen view.

Arguments:

- `payload`\*: Screen view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options passed as the final argument

#### `track`

Record an Experience API custom track event.

Arguments:

- `payload`\*: Track event builder arguments object, including an optional `profile` property with a
  `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options passed as the final argument

#### `trackView`

Record an Insights API entry view event. When the payload marks the entry as "sticky", an additional
Experience API entry view is recorded. This method only returns `OptimizationData` when the entry is
marked as "sticky".

Arguments:

- `payload`\*: Entry view event builder arguments object. When `payload.sticky` is `true`, `profile`
  is optional and the returned Experience profile is reused for Insights delivery. Otherwise,
  `profile` is required and must contain at least an `id`
- `requestOptions`: Optional request-scoped Experience API options passed as the final argument.
  Only used when `payload.sticky` is `true`

#### `trackClick`

Record an Insights API entry click event.

Returns:

- `void`

Arguments:

- `payload`\*: Entry click event builder arguments object, including a required `profile` property
  with a `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options accepted for signature
  consistency; currently unused

#### `trackHover`

Record an Insights API entry hover event.

Returns:

- `void`

Arguments:

- `payload`\*: Entry hover event builder arguments object, including a required `profile` property
  with a `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options accepted for signature
  consistency; currently unused

#### `trackFlagView`

Track a feature flag view via the Insights API. This is functionally the same as a non-sticky flag
view event.

Returns:

- `void`

Arguments:

- `payload`\*: Flag view event builder arguments object, including a required `profile` property
  with a `PartialProfile` value that requires only an `id`
- `requestOptions`: Optional request-scoped Experience API options accepted for signature
  consistency; currently unused

## Stateful-only Core Methods

### `consent`

Updates the user consent state.

Arguments:

- `accept`: A boolean value specifying whether the user has accepted (`true`) or denied (`false`)

### `reset`

Resets all internal state _except_ consent. This method expects no arguments and returns no value.

### `flush`

Flushes queued Insights API and Experience API events. This method expects no arguments and returns
a `Promise<void>`.

### `destroy`

Releases singleton ownership for stateful runtime usage. This is intended for explicit teardown
paths, such as tests or hot-reload workflows. This method expects no arguments and returns no value.

## Core States (`CoreStateful` only)

`states` is available on `CoreStateful` and exposes signal-backed observables for runtime state.

Available state streams:

- `consent`: Current consent state (`boolean | undefined`)
- `blockedEventStream`: Latest blocked-call metadata (`BlockedEvent | undefined`)
- `eventStream`: Latest emitted Insights API or Experience API event
  (`InsightsEvent | ExperienceEvent | undefined`)
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

`current` and callback payloads are deep-cloned snapshots, so local mutations do not affect Core's
internal signal state.

Update behavior:

- `blockedEventStream` updates whenever a call is blocked by consent guards.
- `eventStream` updates when a valid event is accepted for send/queue.
- `flag(name)` updates when the resolved value for that key changes.
- `canOptimize` updates whenever `selectedOptimizations` becomes defined or `undefined`.
- `consent` updates from defaults and `optimization.consent(...)`.
- `previewPanelAttached` and `previewPanelOpen` are controlled by preview tooling and are preserved
  across `reset()`.

Example: read the latest snapshot synchronously:

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

Example: wait for first available profile:

```ts
optimization.states.profile.subscribeOnce((profile) => {
  console.log(`Profile ${profile.id} loaded`)
})
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

## Preview support (internal)

The `@contentful/optimization-core/preview-support` entry point and the `registerPreviewPanel`
method on `CoreStateful` exist solely to back the first-party Contentful preview panel across
platforms. They are **not** part of the public Core SDK surface and are not intended for direct use
by applications or third-party SDKs. They live in this package because the override state machine is
core to that cross-platform preview functionality and must sit alongside the SDK's internal signals
and interceptors.

If you are building on the Optimization SDKs, use your platform SDK's preview panel component rather
than these primitives. For internal documentation of the toolkit, including `registerPreviewPanel`,
see [`src/preview-support/README.md`](./src/preview-support/README.md).
