<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Node SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Optimization Node SDK implements functionality specific to Node environments, based on the
[Optimization Core Library](../../universal/core-sdk/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](../../../README.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Reference Implementations](#reference-implementations)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [API Options](#api-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
- [Optimization Methods](#optimization-methods)
  - [Optimization Data Resolution Methods](#optimization-data-resolution-methods)
    - [`getFlag`](#getflag)
    - [`resolveOptimizedEntry`](#resolveoptimizedentry)
    - [`getMergeTagValue`](#getmergetagvalue)
  - [Experience API and Insights API Event Methods](#experience-api-and-insights-api-event-methods)
    - [`identify`](#identify)
    - [`page`](#page)
    - [`screen`](#screen)
    - [`track`](#track)
    - [`trackView`](#trackview)
    - [`trackClick`](#trackclick)
    - [`trackHover`](#trackhover)
    - [`trackFlagView`](#trackflagview)
- [Interceptors](#interceptors)
  - [Life-cycle Interceptors](#life-cycle-interceptors)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-node
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import ContentfulOptimization from '@contentful/optimization-node'
```

Configure and initialize the Optimization Node SDK:

```ts
const optimization = new ContentfulOptimization({ clientId: 'abc123' })
const requestOptimization = optimization.forRequest()
```

Create `optimization` once per module or process, then call `optimization.forRequest(...)` once per
incoming request.

For a step-by-step Express-style walkthrough that covers request context, profile persistence,
Contentful entry resolution, and hybrid Node + browser setups, see
[Integrating the Optimization Node SDK in a Node App](../../../documentation/integrating-the-node-sdk-in-a-node-app.md).

## Development Harness

The package-local dev harness runs from `packages/node/node-sdk/dev/` and reads `.env` from this
package directory.

1. Start from `.env.example` and create or update `packages/node/node-sdk/.env`.
2. Prefer the repo-standard `PUBLIC_...` variable names shown in `.env.example`.
3. Start the harness from the repo root:

   ```sh
   pnpm --filter @contentful/optimization-node dev
   ```

## Reference Implementations

Reference implementations illustrate how the SDK may be used under common scenarios, as well as
select less-common scenarios, with the most basic example solution possible.

- [Node SSR Only](../../../implementations/node-sdk/README.md): Example application that uses the
  Node SDK to render an optimized Web page
- [Node SSR + Web Vanilla](../../../implementations/node-sdk+web-sdk/README.md): Example application
  demonstrating simple profile synchronization between the Node and
  [Web](../../web/web-sdk/README.md) SDKs via cookie

## Configuration

### Top-level Configuration Options

| Option         | Required? | Default                     | Description                                                                    |
| -------------- | --------- | --------------------------- | ------------------------------------------------------------------------------ |
| `api`          | No        | See "API Options"           | Unified configuration for the Experience API and Insights API endpoints        |
| `app`          | No        | `undefined`                 | The application definition used to attribute events to a specific consumer app |
| `clientId`     | Yes       | N/A                         | Shared API key for Experience API and Insights API requests                    |
| `environment`  | No        | `'main'`                    | The environment identifier                                                     |
| `eventBuilder` | No        | See "Event Builder Options" | Event builder configuration (channel/library metadata, etc.)                   |
| `fetchOptions` | No        | See "Fetch Options"         | Configuration for Fetch timeout and retry functionality                        |
| `logLevel`     | No        | `'error'`                   | Minimum log level for the default console sink                                 |

### API Options

| Option              | Required? | Default                                    | Description                                                  |
| ------------------- | --------- | ------------------------------------------ | ------------------------------------------------------------ |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                              |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Enabled features the Experience API may use for each request |

Request-scoped Experience API options are bound with `optimization.forRequest(...)` instead of the
SDK constructor:

| Option      | Required? | Default     | Description                                                                    |
| ----------- | --------- | ----------- | ------------------------------------------------------------------------------ |
| `ip`        | No        | `undefined` | IP address override used by the Experience API for location analysis           |
| `locale`    | No        | `undefined` | Locale used to translate `location.city` and `location.country`                |
| `plainText` | No        | `undefined` | Sends performance-critical Experience API endpoints in plain text              |
| `preflight` | No        | `undefined` | Instructs the Experience API to aggregate a new profile state but not store it |

### Event Builder Options

Event builder options should only be supplied when building an SDK on top of the Optimization Node
SDK or any of its descendent SDKs.

| Option    | Required? | Default                                                       | Description                                                                        |
| --------- | --------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `channel` | No        | `'server'`                                                    | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library` | No        | `{ name: '@contentful/optimization-node', version: '0.0.0' }` | The client library metadata that is attached to all events                         |

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

## Optimization Methods

Arguments marked with an asterisk (\*) are always required.

### Optimization Data Resolution Methods

#### `getFlag`

Get the specified Custom Flag's value from the provided changes array.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

Behavior notes:

- Node SDK is stateless; `getFlag(...)` does not auto-emit `trackFlagView`.
- If full map resolution is needed for advanced use cases, use
  `optimization.flagsResolver.resolve(changes)`.

> [!NOTE]
>
> If the `changes` argument is omitted, the method will return `undefined`.

#### `resolveOptimizedEntry`

Resolve a baseline Contentful entry to an optimized variant using the provided selected
optimizations.

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
> If the `selectedOptimizations` argument is omitted, the method will return the baseline entry.

#### `getMergeTagValue`

Resolve a "Merge Tag" to a value based on the provided profile. A "Merge Tag" is a special Rich Text
fragment supported by Contentful that specifies a profile data member to be injected into the Rich
Text when rendered.

Arguments:

- `embeddedNodeEntryTarget`\*: The merge tag entry node to resolve
- `profile`: The user profile

> [!NOTE]
>
> If the `profile` argument is omitted, the method will return the merge tag's fallback value.

### Experience API and Insights API Event Methods

Create a request scope once per incoming request, then call event methods on that scope:

```ts
const requestOptimization = optimization.forRequest({
  locale: req.acceptsLanguages()[0] ?? 'en-US',
})
```

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

#### `page`

Record an Experience API page view.

Arguments:

- `payload`\*: Page view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `screen`

Record an Experience API screen view.

Arguments:

- `payload`\*: Screen view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `track`

Record an Experience API custom track event.

Arguments:

- `payload`\*: Track event builder arguments object, including an optional `profile` property with a
  `PartialProfile` value that requires only an `id`

#### `trackView`

Record an Insights API entry view event. When the payload marks the entry as "sticky", an additional
Experience API entry view is recorded. This method only returns `OptimizationData` when the entry is
marked as "sticky".

Arguments:

- `payload`\*: Entry view event builder arguments object. When `payload.sticky` is `true`, `profile`
  is optional and the returned Experience profile is reused for Insights delivery. Otherwise,
  `profile` is required and must contain at least an `id`

#### `trackClick`

Record an Insights API entry click event.

Returns:

- `void`

Arguments:

- `payload`\*: Entry click event builder arguments object, including a required `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `trackHover`

Record an Insights API entry hover event.

Returns:

- `void`

Arguments:

- `payload`\*: Entry hover event builder arguments object, including a required `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `trackFlagView`

Track a feature flag view via the Insights API. This is functionally the same as a non-sticky flag
view event.

Returns:

- `void`

Arguments:

- `payload`\*: Flag view event builder arguments object, including a required `profile` property
  with a `PartialProfile` value that requires only an `id`

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
> Interceptors are intended to enable low-level interoperability and should be used with care.
