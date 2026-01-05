<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Node SDK</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

The Optimization Node SDK implements functionality specific to Node environments, based on the
[Optimization Core Library](/universal/core/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](/README.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Reference Implementations](#reference-implementations)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [Analytics Options](#analytics-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
  - [Personalization Options](#personalization-options)
- [Optimization Methods](#optimization-methods)
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

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-node
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import Optimization from '@contentful/optimization-node'
```

Configure and initialize the Optimization Node SDK:

```ts
const optimization = new Optimization({ clientId: 'abc123' })
```

## Reference Implementations

Reference implementations illustrate how the SDK may be used under common scenarios, as well as
select less-common scenarios, with the most basic example solution possible.

- [Node SSR](/implementations/node-ssr/README.md): Example application that uses the Node SDK to
  render a personalized Web page
- [Node ESR](/implementations/node-esr/README.md): Example application demonstrating simple profile
  synchronization between the Node and [Web](../web/README.md) SDKs via cookie

## Configuration

### Top-level Configuration Options

| Option            | Required? | Default                       | Description                                                                    |
| ----------------- | --------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `analytics`       | No        | See "Analytics Options"       | Configuration specific to the Analytics/Insights API                           |
| `app`             | No        | `undefined`                   | The application definition used to attribute events to a specific consumer app |
| `clientId`        | Yes       | N/A                           | The Ninetailed API Key which can be found in the Ninetailed Admin app          |
| `environment`     | No        | `'main'`                      | The Ninetailed environment configured in the Ninetailed Admin app              |
| `eventBuilder`    | No        | See "Event Builder Options"   | Event builder configuration (channel/library metadata, etc.)                   |
| `fetchOptions`    | No        | See "Fetch Options"           | Configuration for Fetch timeout and retry functionality                        |
| `logLevel`        | No        | `'error'`                     | Minimum log level for the default console sin                                  |
| `personalization` | No        | See "Personalization Options" | Configuration specific to the Personalization/Experience API                   |

### Analytics Options

| Option    | Required? | Default                                    | Description                   |
| --------- | --------- | ------------------------------------------ | ----------------------------- |
| `baseUrl` | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API |

### Event Builder Options

Event builder options should only be supplied when building an SDK on top of the Optimization Node
SDK or any of its descendent SDKs.

| Option    | Required? | Default                                               | Description                                                                        |
| --------- | --------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `channel` | No        | `'server'`                                            | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library` | No        | `{ name: 'Optimization Node API', version: '0.0.0' }` | The client library metadata that is attached to all events                         |

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

## Optimization Methods

Arguments marked with an asterisk (\*) are always required.

### Personalization Data Resolution Methods

#### `getCustomFlag`

Get the specified Custom Flag's value from the provided changes array.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

> [!NOTE]
>
> If the `changes` argument is omitted, the method will return `undefined`.

#### `personalizeEntry`

Resolve a baseline Contentful entry to a personalized variant using the provided selected
personalizations.

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
> If the `personalizations` argument is omitted, the method will return the baseline entry.

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

#### `trackFlagView`

Track a feature flag view via analytics. This is functionally the same as a non-sticky component
view event.

Arguments:

- `payload`\*: Component view event builder arguments object, including an optional `profile`
  property with a `PartialProfile` value that requires only an `id`
