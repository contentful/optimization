<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Core SDK</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

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
  - [Analytics Options](#analytics-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
  - [Personalization Options](#personalization-options)
- [Core Methods](#core-methods)
  - [Personalization Data Resolution Methods](#personalization-data-resolution-methods)
    - [`getCustomFlag`](#getcustomflag)
    - [`personalizeEntry`](#personalizeentry)
    - [`getMergeTagValue`](#getmergetagvalue)
  - [Personalization and Analytics Event Methods](#personalization-and-analytics-event-methods)
    - [`identify`](#identify)
    - [`page`](#page)
    - [`track`](#track)
    - [`trackComponentView`](#trackcomponentview)
    - [`trackFlagView`](#trackflagview)
- [Stateful-only Core Methods](#stateful-only-core-methods)
  - [`consent`](#consent)
  - [`reset`](#reset)
- [Stateful-only Core Properties](#stateful-only-core-properties)
- [Interceptors](#interceptors)
  - [Life-cycle Interceptors](#life-cycle-interceptors)

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
const optimization = new CoreStateful({ clientId: 'abc123' })
// or
const optimization = new CoreStateless({ clientId: 'abc123' })
```

## Working with Stateless Core

The `CoreStateless` class is intended to be used as the basis for SDKs that would run in stateless
environments such as Node-based servers and server-side functions in meta-frameworks such as
Next.js.

In stateless environments, Core will not maintain any internal state, which includes user consent.
These concerns should be handled by consumers to fit their specific architectural and design
specifications.

## Working with Stateful Core

The `CoreStateful` class is intended to be used as the basis for SDKs that would run in stateful
environments such as Web front-ends and mobile applications (via JavaScript runtime containers).

In stateful environments, Core maintains state internally for consent, an event stream, and
profile-related data that is commonly obtained from requests to the Experience API. These states are
exposed externally as read-only observables.

## Configuration

### Top-level Configuration Options

| Option            | Required? | Default                       | Description                                                           |
| ----------------- | --------- | ----------------------------- | --------------------------------------------------------------------- |
| `analytics`       | No        | See "Analytics Options"       | Configuration specific to the Analytics/Insights API                  |
| `clientId`        | Yes       | N/A                           | The Ninetailed API Key which can be found in the Ninetailed Admin app |
| `environment`     | No        | `'main'`                      | The Ninetailed environment configured in the Ninetailed Admin app     |
| `eventBuilder`    | No        | See "Event Builder Options"   | Event builder configuration (channel/library metadata, etc.)          |
| `fetchOptions`    | No        | See "Fetch Options"           | Configuration for Fetch timeout and retry functionality               |
| `logLevel`        | No        | `'error'`                     | Minimum log level for the default console sin                         |
| `personalization` | No        | See "Personalization Options" | Configuration specific to the Personalization/Experience API          |

The following configuration options apply only in stateful environments:

| Option                     | Required? | Default                | Description                                                       |
| -------------------------- | --------- | ---------------------- | ----------------------------------------------------------------- |
| `allowedEventTypes`        | No        | `['identify', 'page']` | Allow-listed event types permitted when consent is not set        |
| `defaults`                 | No        | `undefined`            | Set of default state values applied on initialization             |
| `getAnonymousId`           | No        | `undefined`            | Function used to obtain an anonymous user identifier              |
| `preventedComponentEvents` | No        | `undefined`            | Initial duplication prevention configuration for component events |

Configuration method signatures:

- `getAnonymousId`: `() => string | undefined`

### Analytics Options

| Option    | Required? | Default                                    | Description                   |
| --------- | --------- | ------------------------------------------ | ----------------------------- |
| `baseUrl` | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API |

The following configuration options apply only in stateful environments:

| Option          | Required? | Default     | Description                                                              |
| --------------- | --------- | ----------- | ------------------------------------------------------------------------ |
| `beaconHandler` | No        | `undefined` | Handler used to enqueue events via the Beacon API or a similar mechanism |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`

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

### Personalization Options

| Option            | Required? | Default                               | Description                                                         |
| ----------------- | --------- | ------------------------------------- | ------------------------------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                                     |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Enabled features which the API may use for each request             |
| `ip`              | No        | `undefined`                           | IP address to override the API behavior for IP analysis             |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used to translate `location.city` and `location.country`     |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints in plain text                  |
| `preflight`       | No        | `false`                               | Instructs the API to aggregate a new profile state but not store it |

## Core Methods

The methods in this section are available in both stateful and stateless Core classes. However, be
aware that there are some minor differences in argument usage between stateful and stateless Core
implementations.

Arguments marked with an asterisk (\*) are always required.

### Personalization Data Resolution Methods

#### `getCustomFlag`

Get the specified Custom Flag's value from the provided changes array, or from the current internal
state in stateful implementations.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

> [!NOTE]
>
> If the `changes` argument is omitted in stateless implementations, the method will return
> `undefined`.

#### `personalizeEntry`

Resolve a baseline Contentful entry to a personalized variant using the provided selected
personalizations, or from the current internal state in stateful implementations.

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

> [!NOTE]
>
> If the `personalizations` argument is omitted in stateless implementations, the method will return
> the baseline entry.

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

### Personalization and Analytics Event Methods

Each method except `trackFlagView` may return an `OptimizationData` object containing:

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
- `duplicationScope`: Arbitrary string that may be used to scope component view duplication; used in
  Stateful implementations

#### `trackFlagView`

Track a feature flag view via analytics. This is functionally the same as a non-sticky component
view event.

Arguments:

- `payload`\*: Component view event builder arguments object, including an optional `profile`
  property with a `PartialProfile` value that requires only an `id`
- `duplicationScope`: Arbitrary string that may be used to scope component view duplication; used in
  Stateful implementations

## Stateful-only Core Methods

### `consent`

Updates the user consent state.

Arguments:

- `accept`: A boolean value specifying whether the user has accepted (`true`) or denied (`false`). A
  value of `undefined` implies that the user has not yet explicitly chosen whether to consent.

### `reset`

Resets all internal state _except_ consent. This method expects no arguments and returns no value.

## Stateful-only Core Properties

- `states`: Returns an object mapping of observables for all internal states
  - `consent`: The current state of user consent
  - `eventStream`: The latest event to be queued
  - `flags`: All current resolved Custom Flags
  - `profile`: The current user profile
  - `personalizations`: The current collection of selected personalizations

Each state except `consent` and `eventStream` is updated internally whenever a response from the
Experience API contains a new or updated respective state.

Example `states` observable usage:

```ts
optimization.states.profile.subscribe((profile) => {
  console.log(`Profile ${profile.id} updated!`)
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
